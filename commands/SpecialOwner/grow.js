const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const db = require("../../db");

const WIDTH = 800;
const HEIGHT = 400;

const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: WIDTH, height: HEIGHT });

module.exports = {
    data: new SlashCommandBuilder()
        .setName("grow")
        .setDescription("Affiche un graphique de l'évolution des stats du bot (users & serveurs)")
        .addStringOption(opt =>
            opt.setName("période")
                .setDescription("Choix de la période")
                .setRequired(true)
                .addChoices(
                    { name: "Dernières 24h", value: "jour" },
                    { name: "7 derniers jours", value: "semaine" },
                    { name: "Personnalisé", value: "personnalisé" }
                )
        )
        .addIntegerOption(opt =>
            opt.setName("jours")
                .setDescription("Nombre de jours à afficher (max 60)")
                .setRequired(false)
        ),

    async execute(interaction) {
        const ownerId = "637760775691173888";
        if (interaction.user.id !== ownerId) {
            return interaction.reply({ content: "❌ Tu n'es pas autorisé à utiliser cette commande.", ephemeral: true });
        }

        const période = interaction.options.getString("période");
        const joursOpt = interaction.options.getInteger("jours");

        let days = 7;

        if (période === "jour") days = 1;
        else if (période === "semaine") days = 7;
        else if (période === "personnalisé") {
            if (!joursOpt) {
                return interaction.reply({ content: "❌ Tu dois spécifier un nombre de jours avec `jours:`", ephemeral: true });
            }
            if (joursOpt < 1 || joursOpt > 60) {
                return interaction.reply({ content: "❌ Le nombre de jours doit être entre 1 et 60.", ephemeral: true });
            }
            days = joursOpt;
        }

        const [rows] = await db.execute(`
            SELECT
                DATE(timestamp) AS day,
                MAX(user_count) AS user_count,
                MAX(server_count) AS server_count
            FROM bot_stats
            WHERE timestamp >= NOW() - INTERVAL ? DAY
            GROUP BY day
            ORDER BY day ASC
        `, [days]);

        if (!rows.length) {
            return interaction.reply({ content: "❌ Aucune donnée disponible pour cette période.", ephemeral: true });
        }

        const labels = rows.map(r => r.day);
        const userData = rows.map(r => r.user_count);
        const serverData = rows.map(r => r.server_count);

        const config = {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Utilisateurs",
                        data: userData,
                        borderColor: "rgba(54, 162, 235, 1)",
                        backgroundColor: "rgba(54, 162, 235, 0.2)",
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: "Serveurs",
                        data: serverData,
                        borderColor: "rgba(255, 99, 132, 1)",
                        backgroundColor: "rgba(255, 99, 132, 0.2)",
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                plugins: {
                    title: {
                        display: true,
                        text: `Évolution sur ${days} jour${days > 1 ? "s" : ""}`,
                        font: { size: 18 }
                    },
                    legend: {
                        position: "bottom"
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        };

        const buffer = await chartJSNodeCanvas.renderToBuffer(config);
        const attachment = new AttachmentBuilder(buffer, { name: "growth.png" });

        await interaction.reply({ files: [attachment] });
    }
};
