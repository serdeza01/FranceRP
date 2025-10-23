const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addabsence")
        .setDescription("Ajoute une absence et affiche l'annonce dans le channel configuré")
        .addStringOption((option) =>
            option
                .setName("motif")
                .setDescription("Motif de l'absence")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("date_debut")
                .setDescription("Date de début (JJ/MM/AAAA)")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("date_fin")
                .setDescription("Date de fin (JJ/MM/AAAA)")
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const motif = interaction.options.getString("motif");
        const dateDebutInput = interaction.options.getString("date_debut");
        const dateFinInput = interaction.options.getString("date_fin");

        function convertToSQLDate(dateStr) {
            const [jj, mm, aaaa] = dateStr.split("/");
            return `${aaaa}-${mm}-${jj}`;
        }

        function convertToDisplayDate(sqlDate) {
            let dateStr;
            if (typeof sqlDate === "string") {
                dateStr = sqlDate;
            } else if (sqlDate instanceof Date) {
                dateStr = sqlDate.toISOString().split("T")[0];
            } else {
                dateStr = String(sqlDate);
            }
            const parts = dateStr.split("-");
            if (parts.length !== 3) return sqlDate;
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        const dateDebutSQL = convertToSQLDate(dateDebutInput);
        const dateFinSQL = convertToSQLDate(dateFinInput);

        try {
            const [configRows] = await db.execute(
                "SELECT is_enabled, allowed_role_id, announcement_channel_id FROM absence_config WHERE guild_id = ?",
                [interaction.guild.id]
            );

            if (!configRows.length || !configRows[0].is_enabled) {
                return interaction.editReply("❌ Le système d'absence n'est pas activé sur ce serveur.");
            }

            const allowedRoleId = configRows[0].allowed_role_id;
            if (!interaction.member.roles.cache.has(allowedRoleId)) {
                return interaction.editReply("❌ Vous n'êtes pas autorisé à utiliser cette commande.");
            }

            const [result] = await db.execute(
                "INSERT INTO absences (user_id, guild_id, motif, date_debut, date_fin) VALUES (?, ?, ?, ?, ?)",
                [interaction.user.id, interaction.guild.id, motif, dateDebutSQL, dateFinSQL]
            );
            const absenceId = result.insertId;

            const announcementChannelId = configRows[0].announcement_channel_id;
            const announcementChannel = interaction.guild.channels.cache.get(announcementChannelId);
            if (!announcementChannel) {
                return interaction.editReply("❌ Channel d'annonce introuvable.");
            }

            const embed = new EmbedBuilder()
                .setTitle("Nouvelle absence")
                .setColor(0x00aaff)
                .addFields(
                    { name: "Utilisateur", value: interaction.user.username, inline: true },
                    { name: "Motif", value: motif, inline: true },
                    { name: "Date de début", value: convertToDisplayDate(dateDebutSQL), inline: true },
                    { name: "Date de fin", value: convertToDisplayDate(dateFinSQL), inline: true }
                )
                .setTimestamp();

            await announcementChannel.send({ embeds: [embed] });

            await interaction.editReply("✅ Votre absence a bien été enregistrée et annoncée.");

            try {
                await interaction.user.send(`Votre absence pour le motif "**${motif}**" a été créée avec succès. Conservez précieusement cet ID pour toute modification future : **${absenceId}**`);
            } catch (dmError) {
                console.error(`Impossible d'envoyer un DM à ${interaction.user.tag}.`, dmError);
                await interaction.followUp({ 
                    content: `⚠️ Impossible de vous envoyer l'ID en message privé. Le voici : **${absenceId}**`, 
                    ephemeral: true 
                });
            }

        } catch (error) {
            console.error("Erreur lors de l'ajout de l'absence :", error);
            return interaction.editReply("❌ Une erreur s'est produite lors de l'ajout de l'absence.");
        }
    },
};