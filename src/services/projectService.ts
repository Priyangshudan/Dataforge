import { query, withTransaction } from '../db';
import { User, Project, ProjectMember } from '../types';
import { AppError } from '../middleware/errorHandler';

export class UserService {
  static async listUsers(filters: { role?: string; status?: string; limit?: number; offset?: number }): Promise<User[]> {
    let sql = 'SELECT * FROM users WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (filters.role) {
      sql += ` AND role = $${idx++}`;
      params.push(filters.role);
    }
    if (filters.status) {
      sql += ` AND status = $${idx++}`;
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ` LIMIT $${idx++}`;
      params.push(filters.limit);
    }
    if (filters.offset) {
      sql += ` OFFSET $${idx++}`;
      params.push(filters.offset);
    }

    const res = await query<User>(sql, params);
    return res.rows;
  }

  static async getUserById(id: string): Promise<User> {
    const res = await query<User>('SELECT * FROM users WHERE id = $1', [id]);
    if (res.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', `User with ID ${id} not found.`);
    }
    return res.rows[0];
  }

  static async createUser(data: { name: string; email: string; role?: string; avatar?: string }): Promise<User> {
    const res = await query<User>(
      `INSERT INTO users (name, email, role, avatar)
       VALUES ($1, $2, COALESCE($3, 'VIEWER'), $4)
       RETURNING *`,
      [data.name, data.email, data.role, data.avatar]
    );
    return res.rows[0];
  }
}

export class ProjectService {
  static async listProjects(filters: { search?: string; limit?: number; offset?: number }): Promise<Project[]> {
    let sql = 'SELECT * FROM projects WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (filters.search) {
      sql += ` AND (name ILIKE $${idx} OR description ILIKE $${idx} OR slug ILIKE $${idx})`;
      params.push(`%${filters.search}%`);
      idx++;
    }

    sql += ' ORDER BY created_at DESC';

    if (filters.limit) {
      sql += ` LIMIT $${idx++}`;
      params.push(filters.limit);
    }
    if (filters.offset) {
      sql += ` OFFSET $${idx++}`;
      params.push(filters.offset);
    }

    const res = await query<Project>(sql, params);
    return res.rows;
  }

  static async getProjectById(id: string): Promise<Project> {
    const res = await query<Project>('SELECT * FROM projects WHERE id = $1', [id]);
    if (res.rowCount === 0) {
      throw new AppError(404, 'NOT_FOUND', `Project with ID ${id} not found.`);
    }
    return res.rows[0];
  }

  static async createProject(data: { name: string; slug?: string; description?: string; owner_id: string }): Promise<Project> {
    // Generate slug if not provided
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString().slice(-4);

    // Atomically create project AND owner membership inside the same transaction
    return await withTransaction<Project>(async (client) => {
      // 1. Verify owner exists
      const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [data.owner_id]);
      if (userCheck.rowCount === 0) {
        throw new AppError(400, 'FOREIGN_KEY_VIOLATION', `Owner user with ID ${data.owner_id} does not exist.`);
      }

      // 2. Insert project
      const projRes = await client.query<Project>(
        `INSERT INTO projects (name, slug, description, owner_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.name, slug, data.description || null, data.owner_id]
      );
      const project = projRes.rows[0];

      // 3. Insert owner as project member
      await client.query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1, $2, 'OWNER')
         ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'OWNER'`,
        [project.id, data.owner_id]
      );

      // 4. Log activity
      await client.query(
        `INSERT INTO activity_logs (project_id, user_id, action, entity_type, entity_id, entity_name, details)
         VALUES ($1, $2, 'CREATE', 'PROJECT', $3, $4, $5)`,
        [project.id, data.owner_id, project.id, project.name, `Project '${project.name}' created by owner.`]
      );

      return project;
    });
  }

  static async updateProject(id: string, data: { name?: string; description?: string }): Promise<Project> {
    const existing = await this.getProjectById(id);

    const res = await query<Project>(
      `UPDATE projects
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [data.name, data.description, id]
    );

    return res.rows[0];
  }

  static async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    await this.getProjectById(projectId); // verify existence

    const res = await query<ProjectMember>(
      `SELECT pm.project_id, pm.user_id, pm.role, pm.assigned_at, u.name as user_name, u.email as user_email
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       ORDER BY pm.assigned_at ASC`,
      [projectId]
    );
    return res.rows;
  }

  static async addProjectMember(projectId: string, data: { user_id: string; role?: string }): Promise<ProjectMember> {
    await this.getProjectById(projectId);

    const res = await query<ProjectMember>(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, COALESCE($3, 'MEMBER'))
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [projectId, data.user_id, data.role]
    );
    return res.rows[0];
  }

  static async getProjectDatasets(projectId: string): Promise<any[]> {
    await this.getProjectById(projectId);

    const res = await query(
      `SELECT * FROM dataset_summary_view WHERE project_id = $1 ORDER BY created_at DESC`,
      [projectId]
    );
    return res.rows;
  }
}

