const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, MessageFlags } = require('discord.js');
const db = require('../db.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start')
        .setDescription('Begin your empire in the world of Heisenberg.'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const user = db.getUser(userId);

        // Check if the user already has an account
        if (user) {
            const alreadyStartedEmbed = new ContainerBuilder()
                .setAccentColor(0xFF0000) // Red for error/warning
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(`**You're already in the business, ${interaction.user.username}.**`)
                        .setHeadingLevel(2),
                    new TextDisplayBuilder()
                        .setContent("No turning back now. Use `/profile` to check your status or `/cook` to get to work.")
                );

            return interaction.reply({
                components: [alreadyStartedEmbed],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
        }

        // Create a new user profile object
        const newUser = {
            wallet: 500,
            treasury: 0,
            treasuryCapacity: 5000,
            inventory: {
                blueCrystals: 0,
                purity: 0
            },
            ingredients: {
                'Box Cutter': 2,
                'Sulfuric Acid': 1,
                'Methylamine': 1
            },
            level: 1,
            empirePoints: 0,
            createdAt: new Date().toISOString(),
            lastDaily: null,
            dailyStreak: 0,
            lastWeekly: null,
            lastMonthly: null
        };

        // Save the new user using the db module
        db.createUser(userId, newUser);

        const welcomeContainer = new ContainerBuilder()
            .setAccentColor(0x0099FF) // Heisenberg Blue
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder()
                            .setContent(`**Welcome to the Empire, ${interaction.user.username}.**`)
                            .setHeadingLevel(1),
                        new TextDisplayBuilder()
                            .setContent("You're a novice chemist with a choice to make. You've been given **500 Heisenberg Bucks (₿)** and some starter ingredients. Your journey to the top starts now."),
                        new TextDisplayBuilder()
                            .setContent("\nUse `/cook` to produce Blue Crystals ⌬, then `/sell` to turn your product into cash. Be careful, as others can `/rob` you. Stay sharp.")
                    )
            );

        const tutorialButton = new ButtonBuilder()
            .setCustomId('start_tutorial') // Following the new convention
            .setLabel('View Tutorial')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📚');

        const shopButton = new ButtonBuilder()
            .setCustomId('start_shop') // Following the new convention
            .setLabel('Buy Starter Kit')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🛒');

        const row = new ActionRowBuilder().addComponents(tutorialButton, shopButton);

        await interaction.reply({
            components: [welcomeContainer, row],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};
