import { db } from "../config/db.js";

const Permission = {

  add: async (adminId, permissions) => {
    for (const p of permissions) {
      await db.execute(
        `INSERT INTO permissions
        (admin_id, module_name, can_read, can_write, can_download)
        VALUES (?, ?, ?, ?, ?)`,
        [
          adminId,
          p.module,
          p.read ? 1 : 0,
          p.write ? 1 : 0,
          p.download ? 1 : 0
        ]
      );
    }
  },

  // Ek helper jo check karega ki given admin ke paas
  // kisi module par download permission hai ya nahi
  hasDownloadAccess: async (adminId, moduleName) => {
    const [rows] = await db.execute(
      `SELECT can_download FROM permissions WHERE admin_id = ? AND module_name = ?`,
      [adminId, moduleName]
    );
    if (!rows.length) return false;
    return rows[0].can_download === 1;
  }

};

export default Permission;