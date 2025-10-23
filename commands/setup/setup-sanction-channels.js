const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    EmbedBuilder
} = require("discord.js");
const db = require("../../db");

const EPHEMERAL_FLAG = 1 << 6;

const regex = /^Pseudo\s*:\s*(.+)\nRaison\s*:\s*(.+)\nSanction\s*:\s*([\w\s]+)[\s\S]*$/i;

async function scanAndRegisterSanctions(channel, embedChannel, guildId) {
    if (channel.type === ChannelType.GuildForum) {
        const fetched = await channel.threads.fetchActive();
        for (const thread of fetched.threads.values()) {
            await scanAndRegisterSanctions(thread, embedChannel, guildId);
        }
        return;
    }

    let lastId = null;

    while (true) {
        const options = { limit: 100 };
        if (lastId) options.before = lastId;

        // C'est la ligne qui causait l'erreur
        const fetched = await channel.messages.fetch(options);

        if (!fetched.size) break; // Plus de messages, on arrête la boucle
        lastId = fetched.last().id;

        for (const message of fetched.values()) {
            const m = message.content.match(regex);
            if (!m) continue;

            const [, pseudoRaw, raisonRaw, sanctionRaw] = m;

            // Nettoyer les inputs
            const pseudo = pseudoRaw.replace(/[*_~`]/g, '').trim();
            const raison = raisonRaw.replace(/[*_~`]/g, '').trim();
            // Nettoyage spécial pour la sanction pour gérer le markdown ET les emojis
            const sanctionClean = sanctionRaw.replace(/[*_~`]/g, '').trim();

            let duration = "";
            const durRegex = /^(\d+)\s*([JMA])$/i;

            // Utiliser sanctionClean pour les tests
            if (/^warn$/i.test(sanctionClean)) duration = "Warn";
            else if (/^kick$/i.test(sanctionClean)) duration = "Kick";
            else if (durRegex.test(sanctionClean)) {
                const [, n, u] = sanctionClean.match(durRegex);
                const unite =
                    u.toUpperCase() === "J" ? "jour(s)" :
                    u.toUpperCase() === "M" ? "mois" :
                    "an(s)";
                duration = `${n} ${unite}`;
            }
            else if (/^(perm|permanent)$/i.test(sanctionClean)) duration = "Permanent";
            else continue; // Si la sanction n'est pas reconnue

            const dateApplication = message.createdAt;

            await db.execute(
                `INSERT INTO sanctions
                 (guild_id, punisher_id, pseudo, raison, duration, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    guildId,
                    message.author.id,
                    pseudo,
                    raison,
                    duration,
                    dateApplication
                ]
            );

            const embed = new EmbedBuilder()
                .setTitle("Nouvelle sanction enregistrée")
                .addFields(
                    { name: "Sanctionné par", value: `<@${message.author.id}>`, inline: true },
                    { name: "Pseudo", value: pseudo, inline: true },
                    { name: "Raison", value: raison, inline: true },
                    { name: "Durée", value: duration, inline: true },
                    { name: "Date", value: dateApplication.toLocaleString(), inline: true }
                )
                .setColor("Red")
                .setTimestamp();

            await embedChannel.send({ embeds: [embed] });
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setup-sanction-channels")
        .setDescription("Configure les salons / threads / forums à scanner pour les sanctions")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub.setName("initialiser").setDescription("Définit le salon d'embed, le rôle autorisé, et le premier salon à scanner").addChannelOption(opt => opt.setName("embed").setDescription("Salon où seront postés les embeds de contrôle").setRequired(true).addChannelTypes(ChannelType.GuildText)).addChannelOption(opt => opt.setName("salon").setDescription("Salon / thread / forum à scanner").setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum, ChannelType.PublicThread, ChannelType.PrivateThread)).addRoleOption(opt => opt.setName("role").setDescription("Rôle autorisé à gérer les sanctions").setRequired(true)))
        .addSubcommand(sub => sub.setName("ajouter").setDescription("Ajoute un salon / thread / forum à la configuration existante").addChannelOption(opt => opt.setName("salon").setDescription("Salon / thread / forum à ajouter").setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum, ChannelType.PublicThread, ChannelType.PrivateThread)))
        .addSubcommand(sub => sub.setName("retirer").setDescription("Retire un salon / thread / forum de la configuration").addChannelOption(opt => opt.setName("salon").setDescription("Salon / thread / forum à retirer").setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildForum, ChannelType.PublicThread, ChannelType.PrivateThread))),

    async execute(interaction) {
        const guildId = interaction.guildId;
        const sub = interaction.options.getSubcommand();

        try {
            if (sub === "initialiser") {
                const embedCh = interaction.options.getChannel("embed");
                const salon = interaction.options.getChannel("salon");
                const role = interaction.options.getRole("role");
                await db.execute(`INSERT INTO sanction_config (guild_id, embed_channel_id, channel_ids, allowed_role_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE embed_channel_id = VALUES(embed_channel_id), channel_ids = VALUES(channel_ids), allowed_role_id = VALUES(allowed_role_id)`, [guildId, embedCh.id, JSON.stringify([salon.id]), role.id]);
                
                await interaction.reply({ content: `✅ Initialisation terminée. Début du scan de <#${salon.id}>...\nEmbed dans <#${embedCh.id}>, rôle autorisé : <@&${role.id}>.`, flags: EPHEMERAL_FLAG });
                
                await scanAndRegisterSanctions(salon, embedCh, guildId);

            } else if (sub === "ajouter" || sub === "retirer") {
                const salon = interaction.options.getChannel("salon");
                const [rows] = await db.execute(`SELECT embed_channel_id, channel_ids FROM sanction_config WHERE guild_id = ?`, [guildId]);

                if (!rows.length) {
                    return interaction.reply({ content: "❌ Aucune configuration trouvée, faites `/setup-sanction-channels initialiser` d’abord.", flags: EPHEMERAL_FLAG });
                }

                const cfg = rows[0];
                
                let channelIds = [];
                if (cfg.channel_ids) {
                    if (Array.isArray(cfg.channel_ids)) {
                        channelIds = cfg.channel_ids;
                    } 
                    else if (typeof cfg.channel_ids === 'string') {
                        try {
                            const parsedData = JSON.parse(cfg.channel_ids);
                            if (Array.isArray(parsedData)) {
                                channelIds = parsedData;
                            }
                        } catch (e) {
                            console.error("Impossible de parser channel_ids, la donnée est invalide:", cfg.channel_ids, e);
                        }
                    }
                }

                if (sub === "ajouter") {
                    if (channelIds.includes(salon.id)) {
                        return interaction.reply({ content: "Ce salon/thread/forum est déjà configuré.", flags: EPHEMERAL_FLAG });
                    }
                    channelIds.push(salon.id);
                } else { // retirer
                    if (!channelIds.includes(salon.id)) {
                        return interaction.reply({ content: "Ce salon/thread/forum n'est pas dans la configuration.", flags: EPHEMERAL_FLAG });
                    }
                    channelIds = channelIds.filter(id => id !== salon.id);
                }

                await db.execute(
                    `UPDATE sanction_config SET channel_ids = ? WHERE guild_id = ?`,
                    [JSON.stringify(channelIds), guildId]
                );

                await interaction.reply({ content: sub === "ajouter" ? `✅ Ajouté <#${salon.id}> à la configuration. Début du scan...` : `✅ Retiré <#${salon.id}> de la configuration.`, flags: EPHEMERAL_FLAG });

                if (sub === "ajouter") {
                    const embedCh = await interaction.guild.channels.fetch(cfg.embed_channel_id);
                    await scanAndRegisterSanctions(salon, embedCh, guildId);
                }
            }

        } catch (err) {
            console.error("Erreur dans /setup-sanction-channels :", err);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: "❌ Une erreur est survenue, regarde la console.", flags: EPHEMERAL_FLAG });
            } else {
                await interaction.reply({ content: "❌ Une erreur est survenue, regarde la console.", flags: EPHEMERAL_FLAG });
            }
        }
    }
};