import { db } from "../config/db.js";

const Permission = {

  add: async (adminId, permissions) => {

    for (const p of permissions) {

      await db.execute(
        `INSERT INTO permissions
        (admin_id,module_name,can_read,can_write)
        VALUES (?,?,?,?)`,
        [
          adminId,
          p.module,
          p.read ? 1 : 0,
          p.write ? 1 : 0
        ]
      );

    }

  }

};

export default Permission;