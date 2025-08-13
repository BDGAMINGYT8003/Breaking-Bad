const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

// Helper function to format time remaining
function formatTime(ms) {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${days}d ${hours}h ${minutes}m`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weekly')
        .setDescription('Claim your weekly reward.'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const userData = db.getUser(userId);

        const now = new Date();
        const lastWeekly = userData.lastWeekly ? new Date(userData.lastWeekly) : null;

        // Calculate the last Saturday 6 AM UTC reset time
        let lastReset = new Date(now);
        const dayOfWeek = lastReset.getUTCDay(); // 0=Sun, 6=Sat
        const daysToSubtract = (dayOfWeek < 6) ? dayOfWeek + 1 : 0;
        lastReset.setUTCDate(lastReset.getUTCDate() - daysToSubtract);
        lastReset.setUTCHours(6, 0, 0, 0);

        if (now < lastReset) {
             lastReset.setUTCDate(lastReset.getUTCDate() - 7);
        }

        // --- Cooldown Check ---
        if (lastWeekly && lastWeekly > lastReset) {
            const nextReset = new Date(lastReset);
            nextReset.setUTCDate(nextReset.getUTCDate() + 7);
            const timeRemaining = nextReset - now;
            const cooldownEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Weekly Reward Already Claimed')
                .setDescription(`You've already claimed your weekly reward. Please wait.\n\n**Next claim in:** ${formatTime(timeRemaining)}`);
            return interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
        }

        // --- Reward and Update ---
        const reward = 10000;
        db.updateUser(userId, {
            wallet: userData.wallet + reward,
            lastWeekly: now.toISOString()
        });

        // --- Send Confirmation ---
        const rewardEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Weekly Reward Claimed!')
            .setDescription(`You have successfully claimed your weekly reward of **${reward.toLocaleString()} ₿**!`)
            .setTimestamp();

        await interaction.reply({ embeds: [rewardEmbed] });
    },
};
