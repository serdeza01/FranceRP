const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const db = require("../../db");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("grow")
        .setDescription("Affiche la croissance des utilisateurs et serveurs"),

    async execute(interaction) {
        if (interaction.user.id !== "637760775691173888") {
            return interaction.reply({ content: "❌ Tu n'as pas la permission d'utiliser cette commande.", ephemeral: true });
        }

        const [rows] = await db.execute("SELECT * FROM bot_stats ORDER BY date ASC");

        const labels = rows.map(row => row.date.toISOString().split("T")[0]);
        const userData = rows.map(row => row.user_count);
        const serverData = rows.map(row => row.server_count);

        const width = 800;
        const height = 400;
        const chart = new ChartJSNodeCanvas({ width, height });

        const image = await chart.renderToBuffer({
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Utilisateurs",
                        data: userData,
                        borderColor: "rgba(75, 192, 192, 1)",
                        fill: false
                    },
                    {
                        label: "Serveurs",
                        data: serverData,
                        borderColor: "rgba(255, 99, 132, 1)",
                        fill: false
                    }
                ]
            },
            options: {
                responsive: false,
                plugins: {
                    title: { display: true, text: "Croissance du bot" }
                }
            }
        });

        const attachment = new AttachmentBuilder(image, { name: "growth.png" });
        await interaction.reply({ files: [attachment] });
    }
};
