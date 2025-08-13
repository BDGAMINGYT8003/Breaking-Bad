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
                        .setContent(`**You're already in the business, ${interaction.user.username}.**`),
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
                            .setContent(`**Welcome to the Empire, ${interaction.user.username}.**`),
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

    async handleButton(interaction) {
        const action = interaction.customId.split('_')[1];

        if (action === 'tutorial') {
            const tutorialComponent = new ContainerBuilder()
                .setAccentColor(0x0099FF)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('**Getting Started Tutorial**'),
                    new TextDisplayBuilder().setContent(
                        "1. **Cook:** Use `/cook` to create Blue Crystals ⌬.\n" +
                        "2. **Sell:** Use `/sell` to convert your ⌬ into Heisenberg Bucks ₿.\n" +
                        "3. **Balance:** Use `/balance` to check your wallet and treasury.\n" +
                        "4. **Claim:** Use `/daily`, `/weekly`, and `/monthly` for free ₿.\n" +
                        "5. **Bank:** Use the buttons on `/balance` to stash and haul ₿ to keep it safe from robbers."
                    )
                );
            await interaction.reply({ components: [tutorialComponent], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        } else if (action === 'shop') {
            const shopComponent = new ContainerBuilder()
                .setAccentColor(0x00FF00)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('**Shop**'),
                    new TextDisplayBuilder().setContent("The `/shop` command is coming soon! You'll be able to buy ingredients and upgrade your equipment here.")
                );
            await interaction.reply({ components: [shopComponent], flags: MessageFlags.IsComponentsV2, ephemeral: true });
        }
    }
};
