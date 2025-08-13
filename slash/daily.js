const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db.js');

// Helper function to format time remaining
function formatTime(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward and maintain your streak.'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const userData = db.getUser(userId);

        const now = new Date();
        const lastDaily = userData.lastDaily ? new Date(userData.lastDaily) : null;
        let dailyStreak = userData.dailyStreak;

        // Calculate the last 6 AM UTC reset time
        let lastReset = new Date();
        lastReset.setUTCHours(6, 0, 0, 0);
        if (now < lastReset) {
            lastReset.setUTCDate(lastReset.getUTCDate() - 1);
        }

        // --- Cooldown Check ---
        if (lastDaily && lastDaily > lastReset) {
            const nextReset = new Date(lastReset);
            nextReset.setUTCDate(nextReset.getUTCDate() + 1);
            const timeRemaining = nextReset - now;
            const cooldownEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Daily Reward Already Claimed')
                .setDescription(`You've already claimed your daily reward. Please wait.\n\n**Next claim in:** ${formatTime(timeRemaining)}`);
            return interaction.reply({ embeds: [cooldownEmbed], ephemeral: true });
        }

        // --- Streak Logic ---
        let streakBroken = false;
        let daysSkipped = 0;
        if (lastDaily) {
            const lastClaimDay = new Date(lastDaily);
            lastClaimDay.setUTCHours(0, 0, 0, 0);
            const currentDay = new Date(now);
            currentDay.setUTCHours(0, 0, 0, 0);
            const diffTime = currentDay - lastClaimDay;
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                dailyStreak++;
            } else if (diffDays > 1) {
                streakBroken = true;
                daysSkipped = diffDays - 1;
                dailyStreak = 0;
            }
        }

        // --- Reward Calculation & DB Update ---
        const baseReward = 1000;
        const streakBonus = dailyStreak > 0 ? dailyStreak * 100 : 0;
        const totalReward = baseReward + streakBonus;

        db.updateUser(userId, {
            wallet: userData.wallet + totalReward,
            dailyStreak: dailyStreak,
            lastDaily: now.toISOString()
        });

        // --- Send Confirmation ---
        const rewardEmbed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Daily Reward Claimed!')
            .addFields(
                { name: 'Base Reward', value: `${baseReward.toLocaleString()} ₿`, inline: true },
                { name: 'Streak Bonus', value: `${streakBonus.toLocaleString()} ₿`, inline: true },
                { name: 'Total Reward', value: `**${totalReward.toLocaleString()} ₿**`, inline: true },
                { name: 'New Streak', value: `🔥 ${dailyStreak} day(s)` }
            )
            .setTimestamp();

        if (streakBroken) {
            rewardEmbed.setColor(0xFFCC00)
                .setDescription(`**Warning:** You skipped ${daysSkipped} day(s) and your previous streak has been broken!`);
        }

        await interaction.reply({ embeds: [rewardEmbed] });
    },
};
