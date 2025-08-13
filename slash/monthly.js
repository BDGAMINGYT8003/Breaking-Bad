const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Helper function to format time remaining
function formatTime(ms) {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${days}d ${hours}h ${minutes}m`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('monthly')
        .setDescription('Claim your monthly reward.'),
    async execute(interaction) {
        const usersFilePath = path.join(__dirname, '..', 'database/users.json');
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
        const userData = users[interaction.user.id];

        const now = new Date();
        const lastMonthly = userData.lastMonthly ? new Date(userData.lastMonthly) : null;

        // Calculate the last 1st of the month at 6 AM UTC reset time
        let lastReset = new Date(now);
        lastReset.setUTCDate(1);
        lastReset.setUTCHours(6, 0, 0, 0);

        if (now < lastReset) {
            // If we are before the 1st @ 6AM of the current month, the last reset was the previous month.
            lastReset.setUTCMonth(lastReset.getUTCMonth() - 1);
        }

        // --- Cooldown Check ---
        if (lastMonthly && lastMonthly > lastReset) {
            const nextReset = new Date(lastReset);
            nextReset.setUTCMonth(nextReset.getUTCMonth() + 1);
            const timeRemaining = nextReset - now;

            const cooldownEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Monthly Reward Already Claimed')
                .setDescription(`You've already claimed your monthly reward. Please wait.\n\n**Next claim in:** ${formatTime(timeRemaining)}`);

            return interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
        }

        // --- Reward and Update ---
        const reward = 50000;
        userData.wallet += reward;
        userData.lastMonthly = now.toISOString();
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 4));

        // --- Send Confirmation ---
        const rewardEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Monthly Reward Claimed!')
            .setDescription(`You have successfully claimed your monthly reward of **${reward.toLocaleString()} ₿**!`)
            .setTimestamp();

        await interaction.reply({ embeds: [rewardEmbed] });
    },
};
