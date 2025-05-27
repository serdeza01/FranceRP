const db = require("../db");

async function syncUser(interaction) {
    const userId = interaction.user.id;
    const username = `${interaction.user.username}#${interaction.user.discriminator}`;

    await db.execute(`
        INSERT INTO users (user_id, username)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE username = VALUES(username)
    `, [userId, username]);
}
module.exports = { syncUser };
