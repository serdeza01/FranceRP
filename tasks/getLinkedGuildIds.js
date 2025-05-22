/**
 * @param {import('../db')} db
 * @param {string} guildId
 * @returns {Promise<string[]>}
 */
module.exports = async function getLinkedGuildIds(db, guildId) {
    const [rows] = await db.execute(
        `SELECT guild_id1, guild_id2
     FROM linked_servers
     WHERE guild_id1 = ? OR guild_id2 = ?`,
        [guildId, guildId]
    );
    const set = new Set([guildId]);
    for (const r of rows) {
        set.add(r.guild_id1.toString());
        set.add(r.guild_id2.toString());
    }
    return Array.from(set);
};
