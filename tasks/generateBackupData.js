const { PermissionsBitField } = require("discord.js");

async function generateBackupData(guild) {
    await guild.fetch();
    await guild.roles.fetch();
    await guild.channels.fetch();

    const backup = {
        settings: {
            name: guild.name,
            icon: guild.iconURL({ dynamic: true }),
            verificationLevel: guild.verificationLevel,
            defaultMessageNotifications: guild.defaultMessageNotifications
        },
        roles: [],
        channels: []
    };

    const roles = guild.roles.cache
        .filter(role => role.name !== "@everyone")
        .sort((a, b) => a.position - b.position);

    for (const role of roles.values()) {
        backup.roles.push({
            id: role.id,
            name: role.name,
            color: role.hexColor,
            hoist: role.hoist,
            mentionable: role.mentionable,
            permissions: role.permissions.bitfield.toString(),
            position: role.position
        });
    }

    const channels = [...guild.channels.cache.values()]
        .sort((a, b) => a.position - b.position);

    for (const channel of channels) {
        const base = {
            id: channel.id,
            name: channel.name,
            type: channel.type,
            position: channel.position,
            parent: channel.parentId,
            topic: channel.topic || null,
            nsfw: channel.nsfw || false,
            rateLimitPerUser: channel.rateLimitPerUser || 0,
            permissionOverwrites: []
        };

        const overwrites = [...channel.permissionOverwrites.cache.values()];
        for (const overwrite of overwrites) {
            base.permissionOverwrites.push({
                id: overwrite.id,
                type: overwrite.type,
                allow: overwrite.allow.bitfield.toString(),
                deny: overwrite.deny.bitfield.toString()
            });
        }

        if (channel.isTextBased() && channel.type !== 4) {
            try {
                const messages = await channel.messages.fetch({ limit: 10 });
                base.messages = messages.map(msg => ({
                    author: msg.author.id,
                    content: msg.content,
                    timestamp: msg.createdAt.toISOString()
                })).reverse();
            } catch (err) {
                base.messages = [];
            }
        }

        backup.channels.push(base);
    }

    return backup;
}

module.exports = { generateBackupData };
