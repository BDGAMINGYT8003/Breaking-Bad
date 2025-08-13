const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, MessageFlags } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('start')
        .setDescription('Begin your empire in the world of Heisenberg.'),
    async execute(interaction) {
        const usersFilePath = path.join(__dirname, '..', 'database/users.json');
        const usersData = fs.readFileSync(usersFilePath, 'utf-8');
        const users = JSON.parse(usersData);

        // Check if the user already has an account
        if (users[interaction.user.id]) {
            const alreadyStartedEmbed = new ContainerBuilder()
                .setAccentColor(0xFF0000) // Red for error/warning
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(`**You're already in the business, ${interaction.user.username}.**`)
                        .setHeadingLevel(2),
                    new TextDisplayBuilder()
                        .setContent("No turning back now. Use `/profile` to check your status or `/cook` to get to work.")
                );

            await interaction.reply({
                components: [alreadyStartedEmbed],
                flags: MessageFlags.IsComponentsV2,
                ephemeral: true
            });
            return;
        }

        // Create a new user profile
        users[interaction.user.id] = {
            wallet: 500,
            safehouse: 0,
            inventory: {
                blueCrystals: 0,
                purity: 0
            },
            ingredients: {
                // Starter ingredients for one batch
                'Box Cutter': 2,
                'Sulfuric Acid': 1,
                'Methylamine': 1
            },
            level: 1,
            empirePoints: 0,
            createdAt: new Date().toISOString()
        };

        // Save the updated user data
        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 4));

        // Create the rich welcome message using Components V2
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
            .setCustomId('tutorial_button') // In a real scenario, you'd handle this interaction
            .setLabel('View Tutorial')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📚');

        const shopButton = new ButtonBuilder()
            .setCustomId('shop_button_starter') // This should likely trigger the /shop command or a specific modal
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
