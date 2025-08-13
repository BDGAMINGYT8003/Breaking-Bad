const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout } = require('node:timers/promises');

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
        const usersFilePath = path.join(__dirname, '..', 'database/users.json');
        const users = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
        const userData = users[interaction.user.id];

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
            // Calculate the difference in days, anchored to UTC midnight
            const lastClaimDay = new Date(lastDaily);
            lastClaimDay.setUTCHours(0, 0, 0, 0);

            const currentDay = new Date(now);
            currentDay.setUTCHours(0, 0, 0, 0);

            const diffTime = currentDay - lastClaimDay;
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                // Streak continues
                dailyStreak++;
            } else if (diffDays > 1) {
                // Streak is broken
                streakBroken = true;
                daysSkipped = diffDays -1;
                dailyStreak = 0; // Reset streak
            }
            // if diffDays is 0, something is wrong with the cooldown logic, but we let it pass.
        }

        // --- Reward Calculation ---
        const baseReward = 1000;
        const streakBonus = dailyStreak > 0 ? dailyStreak * 100 : 0;
        const totalReward = baseReward + streakBonus;

        // --- Update Database ---
        userData.wallet += totalReward;
        userData.dailyStreak = dailyStreak;
        userData.lastDaily = now.toISOString();
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 4));

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
            rewardEmbed.setColor(0xFFCC00); // Yellow for warning
            rewardEmbed.setDescription(`**Warning:** You skipped ${daysSkipped} day(s) and your previous streak has been broken!`);
        }

        await interaction.reply({ embeds: [rewardEmbed] });
    },
};
