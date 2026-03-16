const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require("fs");

let points = {};
if (fs.existsSync("points.json")) {
  points = JSON.parse(fs.readFileSync("points.json", "utf8"));
} else {
  fs.writeFileSync("points.json", JSON.stringify(points, null, 2));
}

let pairs = JSON.parse(fs.readFileSync("pairs.json"));

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const PAIR_CHANNEL = process.env.PAIR_CHANNEL;
const UNPAIR_CHANNEL = process.env.UNPAIR_CHANNEL;
const DFIL_FAIL_CHANNEL = process.env.DFIL_FAIL_CHANNEL;
const DFIL_FAIL_ROLE = process.env.DFIL_FAIL_ROLE;
const PAIR_ROLE = process.env.PAIR_ROLE;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const commands = [
  new SlashCommandBuilder()
    .setName('pair')
    .setDescription('Pair two users for DFIL')
    .addUserOption(option =>
      option.setName('user1').setDescription('First user').setRequired(true))
    .addUserOption(option =>
      option.setName('user2').setDescription('Second user').setRequired(true)),

  new SlashCommandBuilder()
    .setName('unpair')
    .setDescription('Unpair a DFIL pair')
    .addUserOption(option =>
      option.setName('user').setDescription('User to unpair').setRequired(true)),

  new SlashCommandBuilder()
    .setName('partner')
    .setDescription('Check current DFIL partner of user')
    .addUserOption(option =>
      option.setName('user').setDescription('User to check partner for').setRequired(true)),

  new SlashCommandBuilder()
    .setName('dfil_fail')
    .setDescription('Gives the pair a role for successfully failing the DFIL challenge')
    .addUserOption(option =>
      option.setName('user1').setDescription('First user').setRequired(true))
    .addUserOption(option =>
      option.setName('user2').setDescription('Second user').setRequired(true)),

  new SlashCommandBuilder()
    .setName('points_add')
    .setDescription('Add points to a pair for completing challenges')
    .addUserOption(option =>
      option.setName('user1').setDescription('First user').setRequired(true))
    .addUserOption(option =>
      option.setName('user2').setDescription('Second user').setRequired(true))
    .addIntegerOption(option =>
      option.setName('points').setDescription('Number of points to add').setRequired(true)),

].map(command => command.toJSON());

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {

    // ---------------- PAIR ----------------
    if (interaction.commandName === 'pair') {
      const user1 = interaction.options.getUser('user1');
      const user2 = interaction.options.getUser('user2');

      if (pairs[user1.id] || pairs[user2.id]) {
        return interaction.reply({
          content: "❌ One or more of the participants is already paired.",
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      pairs[user1.id] = user2.id;
      pairs[user2.id] = user1.id;
      fs.writeFileSync("pairs.json", JSON.stringify(pairs, null, 2));

      const member1 = await interaction.guild.members.fetch(user1.id);
      const member2 = await interaction.guild.members.fetch(user2.id);
      const pairRole = interaction.guild.roles.cache.get(PAIR_ROLE);
      if (pairRole) {
        await member1.roles.add(pairRole).catch(() => {});
        await member2.roles.add(pairRole).catch(() => {});
      }

      const pairChannel = await client.channels.fetch(PAIR_CHANNEL);

      const embed = new EmbedBuilder()
        .setTitle("💌 New DFIL pair deployed!")
        .setDescription(`**${user1} and ${user2} have been chosen for the DFIL Challenge** by <@${interaction.user.id}>!!\nComplete the challenges together and try **not to fall for each other**`)
        .setImage("https://cdn.discordapp.com/attachments/1482743103881351180/1482950370396475582/0fc767553359ab90835e5023261f5f09.gif?ex=69b8d0a8&is=69b77f28&hm=86692b9017cc5d29d702c187e9fba6dd0495c901f33eafa09186efcce4d7d97e&")
        .setThumbnail("https://cdn.discordapp.com/attachments/1482743103881351180/1482995141059936298/1000036804-removebg-preview.png?ex=69b8fa5a&is=69b7a8da&hm=23a555bca5dc7728fc1389cfd0b489f04c1617f0b173f9de31748c4cff26e8a8&")
        .setColor("#313338")
        .setFooter({ text: "Good luck staying un-fallen for the week, CHALLENGE BEGINS!!" });

      await pairChannel.send({ embeds: [embed] });
      await pairChannel.send(`💌 ${user1} and ${user2} have been paired for the **DFIL Challenge!**\n   Good luck staying *un-fallen* for the week!!`);

      await interaction.editReply({ content: "✅ Pair created successfully!" });
    }

    // ---------------- UNPAIR ----------------
    if (interaction.commandName === 'unpair') {
      const user = interaction.options.getUser('user');

      if (!pairs[user.id]) {
        return interaction.reply({
          content: "❌ This user is not currently paired.",
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const partnerId = pairs[user.id];
      delete pairs[user.id];
      delete pairs[partnerId];
      fs.writeFileSync("pairs.json", JSON.stringify(pairs, null, 2));

      const guild = interaction.guild;
      const pairRole = guild.roles.cache.get(PAIR_ROLE);
      const failRole = guild.roles.cache.get(DFIL_FAIL_ROLE);

      const member1 = await guild.members.fetch(user.id).catch(() => null);
      const member2 = await guild.members.fetch(partnerId).catch(() => null);

      if (pairRole) {
        if (member1) await member1.roles.remove(pairRole).catch(() => {});
        if (member2) await member2.roles.remove(pairRole).catch(() => {});
      }
      if (failRole) {
        if (member1) await member1.roles.remove(failRole).catch(() => {});
        if (member2) await member2.roles.remove(failRole).catch(() => {});
      }

      const unpairChannel = await client.channels.fetch(UNPAIR_CHANNEL);

      const embed = new EmbedBuilder()
        .setTitle("💔 DFIL Pair Terminated")
        .setDescription(`<@${user.id}> and <@${partnerId}> have been unpaired. **Better luck next time!**`)
        .setColor("#ff4d6d")
        .setImage("https://cdn.discordapp.com/attachments/1482743103881351180/1482959104203817000/IMG_20260316_095944.jpg")
        .setFooter({ text: "Better luck with your next pair!" });

      await unpairChannel.send({ embeds: [embed] });
      await unpairChannel.send(`<@${user.id}> and <@${partnerId}> have been unpaired.`);

      await interaction.editReply({
        content: `Successfully unpaired <@${user.id}> and <@${partnerId}> and removed all related roles!`
      });
    }

    // ---------------- PARTNER ----------------
    if (interaction.commandName === 'partner') {
      const user = interaction.options.getUser('user');

      if (!pairs[user.id]) {
        return interaction.reply({
          content: `<@${user.id}> is currently unpaired.`,
          flags: MessageFlags.Ephemeral
        });
      }

      const partnerId = pairs[user.id];

      const embed = new EmbedBuilder()
        .setTitle("ᜊ Partner check ᯓ★")
        .setDescription(`<@${user.id}> is curently trying not to fall for <@${partnerId}> 💌`)
        .setColor("#7950dd")
        .setImage("https://cdn.discordapp.com/attachments/1482743103881351180/1482968095902400602/e4cb6e21e0f68ff073dc3d64f61c47bd.gif?ex=69b8e12a&is=69b78faa&hm=7eb35cf1bb579b859b6e54f89dfe5ffa5e9486d37237eb95d012b8f62d89a408&")
        .setFooter({ text: "Stay un-fallen!" });

      await interaction.reply({ embeds: [embed] });
    }

    // ---------------- POINTS ADD ----------------
    if (interaction.commandName === 'points_add') {
      const user1 = interaction.options.getUser('user1');
      const user2 = interaction.options.getUser('user2');
      const newPoints = interaction.options.getInteger('points');

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const pairKey = [user1.id, user2.id].sort().join('_');
      if (!points[pairKey]) points[pairKey] = 0;
      points[pairKey] += newPoints;
      fs.writeFileSync('points.json', JSON.stringify(points, null, 2));

      await interaction.editReply({
        content: `✅ Added ${newPoints} points to <@${user1.id}> and <@${user2.id}>. Pair total: ${points[pairKey]} points.`
      });
    }

    // ---------------- DFIL FAIL ----------------
    if (interaction.commandName === 'dfil_fail') {
      const user1 = interaction.options.getUser('user1');
      const user2 = interaction.options.getUser('user2');

      if (pairs[user1.id] !== user2.id) {
        return interaction.reply({
          content: "❌ These users are not a DFIL pair.",
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const member1 = await interaction.guild.members.fetch(user1.id);
      const member2 = await interaction.guild.members.fetch(user2.id);

      const failRole = interaction.guild.roles.cache.get(DFIL_FAIL_ROLE);
      if (failRole) {
        await member1.roles.add(failRole).catch(() => {});
        await member2.roles.add(failRole).catch(() => {});
      }

      const failChannel = await client.channels.fetch(DFIL_FAIL_CHANNEL);

      const embed = new EmbedBuilder()
        .setTitle("DFIL Challenge Failed Successfully")
        .setDescription(`Looks like the challenge didn't survive...\nBut something else blossomed instead\n\n<@${user1.id}> and <@${user2.id}>\n\nsuccessfully failed the DFIL challenge\n💞 But gained something better.`)
        .setColor("#ecb0c1")
        .setImage("https://cdn.discordapp.com/attachments/1482743103881351180/1482988248132227072/1f440be772da754271d500c4c91f5609.jpg?ex=69b8f3ee&is=69b7a26e&hm=ffc377825321e35555578882194dc72b2accf71a84416f144c5a575ec2ea4305&");

      await failChannel.send({ embeds: [embed] });
      await failChannel.send(`<@${user1.id}> and <@${user2.id}> have failed the DFIL challenge but won something way better!!`);

      await interaction.editReply({ content: "💘 DFIL failure recorded." });
    }

  } catch (error) {
    console.error(`Error handling command ${interaction.commandName}:`, error);
    try {
      const msg = { content: "❌ Something went wrong. Please try again.", flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply(msg);
      }
    } catch (_) {}
  }
});

// ---------------- MEMBER LEAVE ----------------
client.on('guildMemberRemove', async (member) => {
  const userId = member.id;

  if (pairs[userId]) {
    const partnerId = pairs[userId];

    delete pairs[userId];
    delete pairs[partnerId];
    fs.writeFileSync("pairs.json", JSON.stringify(pairs, null, 2));

    const guild = member.guild;
    const partnerMember = guild.members.cache.get(partnerId);
    if (partnerMember) {
      const pairRole = guild.roles.cache.get(PAIR_ROLE);
      const dfilFailRole = guild.roles.cache.get(DFIL_FAIL_ROLE);
      if (pairRole) await partnerMember.roles.remove(pairRole).catch(() => {});
      if (dfilFailRole) await partnerMember.roles.remove(dfilFailRole).catch(() => {});
    }

    const unpairChannel = await client.channels.fetch(UNPAIR_CHANNEL);
    await unpairChannel.send(
      `💔 <@${userId}> left the server. Their DFIL pair <@${partnerId}> has been unpaired automatically.`
    );
  }
});

client.on('error', (error) => {
  console.error('Client error:', error);
});

async function main() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Slash commands registered successfully.');
  } catch (error) {
    console.error('Failed to register commands:', error);
  }

// Imports
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// =====================
// Express server to keep bot alive (for monitoring if needed)
const app = express();
const PORT = process.env.PORT; // JustRunMy.App provides this automatically

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

app.listen(PORT, () => console.log(`Express server running on port ${PORT}`));

// =====================
// Discord Bot Logic
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
  if (message.content === '!ping') {
    message.channel.send('Pong!');
  }
});

// Login using environment variable
client.login(process.env.TOKEN);

  await client.login(TOKEN);
}

main();
