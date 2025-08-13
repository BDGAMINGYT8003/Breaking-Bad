const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const db = require('../db.js');

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
            const timestamp = Math.floor(nextReset.getTime() / 1000);

            const cooldownComponent = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('**Daily Reward Already Claimed**'),
                    new TextDisplayBuilder().setContent(`You can claim your next daily reward <t:${timestamp}:R>.`)
                );

            return interaction.reply({ components: [cooldownComponent], flags: MessageFlags.IsComponentsV2, ephemeral: true });
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
        const baseReward = 10000;
        const streakBonus = dailyStreak > 0 ? dailyStreak * 250 : 0;
        const totalReward = baseReward + streakBonus;

        db.updateUser(userId, {
            wallet: userData.wallet + totalReward,
            dailyStreak: dailyStreak,
            lastDaily: now.toISOString()
        });

        // --- Send Confirmation ---
        const components = [];
        const rewardContainer = new ContainerBuilder()
            .setAccentColor(0x00FF00)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent('**Daily Reward Claimed!**'),
                new TextDisplayBuilder().setContent(`**Base Reward:** ${baseReward.toLocaleString()} ₿`),
                new TextDisplayBuilder().setContent(`**Streak Bonus:** ${streakBonus.toLocaleString()} ₿`),
                new TextDisplayBuilder().setContent(`**Total Reward:** ${totalReward.toLocaleString()} ₿`),
                new TextDisplayBuilder().setContent(`**New Streak:** 🔥 ${dailyStreak} day(s)`)
            );

        if (streakBroken) {
            rewardContainer.setAccentColor(0xFFCC00);
            const warningText = new TextDisplayBuilder()
                .setContent(`**Warning:** You skipped ${daysSkipped} day(s) and your previous streak has been broken!`);
            // Insert warning at the beginning of the text components
            rewardContainer.components.splice(1, 0, warningText);
        }

        components.push(rewardContainer);
        await interaction.reply({ components, flags: MessageFlags.IsComponentsV2 });
    },
};
