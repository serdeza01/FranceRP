const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const db = require("../../db");
const zlib = require("zlib");
const { syncUser } = require("../../tasks/users-backup-commands");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("backup-restore")
        .setDescription("Restaure une sauvegarde du serveur")
        .addIntegerOption(opt =>
            opt.setName("id")
                .setDescription("ID de la sauvegarde à restaurer")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await syncUser(interaction);
        const backupId = interaction.options.getInteger("id");
        const userId = interaction.user.id;
        const guild = interaction.guild;

        await interaction.deferReply({ ephemeral: true });

        const [[backup]] = await db.execute(`
            SELECT * FROM backups WHERE id = ? AND user_id = ?
        `, [backupId, userId]);

        if (!backup) {
            return interaction.editReply({
                content: "❌ Aucune sauvegarde trouvée avec cet ID vous appartenant."
            });
        }

        let backupData;
        try {
            const decompressed = zlib.inflateSync(Buffer.from(backup.data, "base64"));
            backupData = JSON.parse(decompressed.toString());
        } catch (err) {
            return interaction.editReply({
                content: "❌ Erreur lors de la lecture de la sauvegarde."
            });
        }

        for (const channel of guild.channels.cache.values()) {
            await channel.delete().catch(() => { });
        }

        for (const role of guild.roles.cache.values()) {
            if (role.managed || role.id === guild.id) continue;
            await role.delete().catch(() => { });
        }

        const roleMap = new Map();
        const sortedRoles = backupData.roles.sort((a, b) => a.position - b.position);

        for (const roleData of sortedRoles) {
            const newRole = await guild.roles.create({
                name: roleData.name,
                color: roleData.color,
                hoist: roleData.hoist,
                mentionable: roleData.mentionable,
                permissions: BigInt(roleData.permissions)
            }).catch(() => null);

            if (newRole) {
                roleMap.set(roleData.name, newRole.id);
            }
        }

        const channelMap = new Map();
        const categories = backupData.channels.filter(c => c.type === 4);
        const others = backupData.channels.filter(c => c.type !== 4);

        for (const category of categories) {
            const newCategory = await guild.channels.create({
                name: category.name,
                type: category.type,
                position: category.position,
                permissionOverwrites: category.permissionOverwrites.map(po => ({
                    id: po.id,
                    allow: BigInt(po.allow),
                    deny: BigInt(po.deny),
                    type: po.type
                }))
            }).catch(() => null);

            if (newCategory) {
                channelMap.set(category.id, newCategory.id);
            }
        }

        for (const channelData of others) {
            let parentId = null;
            if (channelData.parent && channelMap.has(channelData.parent)) {
                parentId = channelMap.get(channelData.parent);
            }

            const newChannel = await guild.channels.create({
                name: channelData.name,
                type: channelData.type,
                position: channelData.position,
                topic: channelData.topic,
                nsfw: channelData.nsfw,
                rateLimitPerUser: channelData.rateLimitPerUser,
                parent: parentId,
                permissionOverwrites: channelData.permissionOverwrites.map(po => ({
                    id: po.id,
                    allow: BigInt(po.allow),
                    deny: BigInt(po.deny),
                    type: po.type
                }))
            }).catch(() => null);

            if (newChannel) {
                channelMap.set(channelData.id, newChannel.id);

                if (channelData.messages?.length && newChannel.isTextBased()) {
                    for (const message of channelData.messages) {
                        const content = `📦 **Backup**\n🕒 ${new Date(message.timestamp).toLocaleString()}\n👤 <@${message.author}>\n💬 ${message.content}`;
                        await newChannel.send(content).catch(() => { });
                    }
                }
            }
        }

        await db.execute(
            `INSERT INTO backups_restored (backup_id, user_id, guild_id, restored_at) VALUES (?, ?, ?, NOW())`,
            [backupId, userId, guild.id]
        );

        await db.execute(`
    INSERT INTO backup_restores (backup_id, user_id, guild_id)
    VALUES (?, ?, ?)
`, [backup.id, userId, guild.id]);


        return interaction.editReply({
            content: `✅ Sauvegarde **${backup.name}** restaurée avec succès !`
        });
    }
};
