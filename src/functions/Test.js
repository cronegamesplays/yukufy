const { Client, GatewayIntentBits, InteractionType, REST, Routes } = require('discord.js');
const { DistifyClient } = require('../utils/Player');

// Create a new Discord client instance with specified intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages
  ]
});

// Initialize the DistifyClient with configuration for API and player
const distify = new DistifyClient(client, {
  configApi: {
    clientId: "YourSpotifyClientId",
    clientSecret: "YourSpotifyClientSecret"
  },
  configPlayer: {
    defaultVolume: 75,
    leaveOnEmptyQueue: true,
    leaveOnEmptyQueueCooldown: 10000
  }
});

// Your Discord bot token
const clientToken = "YourBotToken";

// Define the slash commands for the bot
const commands = [
  {
    name: 'play',
    description: 'Play a song in the voice channel',
    options: [
      {
        name: 'query',
        type: 3, // Type STRING
        description: 'Name of the song or URL',
        required: true
      }
    ]
  },
  {
    name: 'stop',
    description: 'Stop the music and leave the voice channel'
  },
  {
    name: 'skip',
    description: 'Skip to the next song in the queue'
  },
  {
    name: 'pause',
    description: 'Pause the current song'
  },
  {
    name: 'resume',
    description: 'Resume the paused song'
  },
  {
    name: 'volume',
    description: 'Adjust the volume of the player',
    options: [
      {
        name: 'number',
        type: 10, // Type NUMBER
        description: 'Volume between 0 and 100',
        required: true
      }
    ]
  },
  {
    name: 'search',
    description: 'Search for a song on Spotify or SoundCloud',
    options: [
      {
        name: 'query',
        type: 3, // Type STRING
        description: 'Name of the song or URL',
        required: true
      },
      {
        name: 'source',
        type: 3, // Type STRING
        description: 'Source (spotify or soundcloud)',
        required: true,
        choices: [
          {
            name: 'Spotify',
            value: 'spotify'
          },
          {
            name: 'SoundCloud',
            value: 'soundcloud'
          }
        ]
      }
    ]
  },
  {
    name: 'queue',
    description: 'Show the song queue'
  },
  {
    name: 'join',
    description: 'Join the voice channel'
  },
  {
    name: 'leave',
    description: 'Leave the voice channel'
  },
  {
    name: 'loop',
    description: 'Toggle the repeat mode'
  },
  {
    name: 'nowplaying',
    description: 'Show the currently playing song'
  },
  {
    name: 'lyrics',
    description: 'Show the lyrics of the current song or a specific song',
    options: [
      {
        name: 'query',
        type: 3, // Type STRING
        description: 'Name of the song (optional)',
        required: false
      }
    ]
  }
];

// Initialize REST API with the bot token
const rest = new REST({ version: '10' }).setToken(clientToken);

async function main() {
  try {
    console.log('Starting slash command registration.');

    // Register the slash commands with Discord
    await rest.put(
      Routes.applicationCommands("1216138439972491324"),
      { body: commands }
    );

    console.log('Slash commands registered successfully.');
  } catch (error) {
    console.error('Error registering slash commands:', error);
  }

  // Event fired when the client is ready
  client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
  });

  // Event fired when an interaction is created
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    if (interaction.type !== InteractionType.ApplicationCommand) return;
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    // Handle the 'play' command
    if (commandName === 'play') {
      const song = options.getString('query');
      const channel = interaction.member.voice.channel;
      const source = "spotify"; // "soundcloud"

      if (!channel) {
        await interaction.reply({ content: 'You need to be in a voice channel to play music!' });
        return;
      }
      try {
        const music = await distify.play(song, channel, source, {
          member: interaction.member,
          textChannel: interaction.channel,
          guildId: interaction.guild.id
        });
        if (!music) {
          await interaction.reply('❌ Song not found.');
          return;
        }
        const title = music.title || 'Title not available';
        const artist = music.artist || 'Artist not available';
        const duration = music.duration || 'Duration not available';
        
        await interaction.reply({
          content: `🔊 Searching... Song found: **${artist}** - **${title}** | **${duration}**`,
          ephemeral: false
        });
      } catch (error) {
        await interaction.reply('❌ Error playing song');
        console.error(error);
      }
    }

    // Handle the 'stop' command
    if (commandName === 'stop') {
      distify.stop();
      await interaction.reply('🛑 Music stopped.');
    }

    // Handle the 'skip' command
    if (commandName === 'skip') {
      distify.skip();
      await interaction.reply('⏭️ Song skipped.');
    }

    // Handle the 'pause' command
    if (commandName === 'pause') {
      distify.pause();
      await interaction.reply('⏸️ Music paused.');
    }

    // Handle the 'resume' command
    if (commandName === 'resume') {
      distify.resume();
      await interaction.reply('▶️ Music resumed.');
    }

    // Handle the 'volume' command
    if (commandName === 'volume') {
      const volume = options.getNumber('number');
      try {
        distify.setVolume(volume);
        await interaction.reply(`🔊 Volume set to: ${volume}`);
      } catch (error) {
        await interaction.reply('❌ Error adjusting volume');
        console.error(error);
      }
    }

    // Handle the 'search' command
    if (commandName === 'search') {
      const query = options.getString('query');
      const source = options.getString('source');
      try {
        const results = await distify.search(query, source);
        if (results && results.length > 0) {
          const searchResults = results.map((r, index) => `${index + 1}. **${r.title}** by **${r.artist}**`).join('\n');
          await interaction.reply(`🔍 Search results:\n${searchResults}`);
        } else {
          await interaction.reply('No results found.');
        }
      } catch (error) {
        await interaction.reply('Error searching for songs.');
        console.error(error);
      }
    }

    // Handle the 'queue' command
    if (commandName === 'queue') {
      try {
        const queue = await distify.getQueue();
        if (queue.length === 0) {
          await interaction.reply('The queue is empty.');
        } else {
          const queueString = queue.map(track => `${track.position}. ${track.title} - ${track.artist}`).join('\n');
          await interaction.reply(`🎵 Song queue:\n${queueString}`);
        }
      } catch (error) {
        console.error('Error getting the queue:', error);
        await interaction.reply('An error occurred while trying to get the song queue.');
      }
    }

    // Handle the 'join' command
    if (commandName === 'join') {
      const channel = interaction.member.voice.channel;

      if (!channel) {
        await interaction.reply('You need to be in a voice channel to invite me!');
        return;
      }

      try {
        await distify.join(channel);
        await interaction.reply(`🔊 Joined the voice channel: ${channel.name}`);
      } catch (error) {
        await interaction.reply('❌ Error joining the voice channel');
        console.error(error);
      }
    }

    // Handle the 'leave' command
    if (commandName === 'leave') {
      try {
        distify.leave(interaction.member.voice.channel.id);
        await interaction.reply('👋 Left the voice channel.');
      } catch (error) {
        await interaction.reply('❌ Error leaving the voice channel');
        console.error(error);
      }
    }

    // Handle the 'loop' command
    if (commandName === 'loop') {
      try {
        const loopOnOff = await distify.toggleLoop();
        const statusMessage = loopOnOff ? 'enabled' : 'disabled';
        await interaction.reply(`🔄 Loop is now ${statusMessage}`);
      } catch (error) {
        console.error('Error toggling loop:', error);
        await interaction.reply('❌ There was an error trying to toggle the loop.');
      }
    }    

    // Handle the 'nowplaying' command
    if (commandName === 'nowplaying') {
      const nowPlaying = await distify.nowPlaying();
      if (nowPlaying) {
        const title = nowPlaying.title || 'Title not available';
        const artist = nowPlaying.artist || 'Artist not available';
        const url = nowPlaying.url || 'URL not available';
        const duration = nowPlaying.duration || 'Duration not available';
        const elapsedTime = nowPlaying.elapsedTime || 'Elapsed time not available';
        
        await interaction.reply(`🎶 Now playing: **[${title}](${url})**\n🎤 Artist: **${artist}**\n⏱️ Duration: **${elapsedTime}**`);
      } else {
        await interaction.reply('No song is currently playing.');
      }
    }  

    // Handle the 'lyrics' command
    if (commandName === 'lyrics') {
      const query = options.getString('query');
  
      try {
        let searchQuery;
        
        // If no query, try to get the currently playing song
        if (!query) {
          const nowPlaying = await distify.nowPlaying();
          
          if (!nowPlaying) {
            return await interaction.reply('No song playing at the moment and no search query provided.');
          }
  
          // Use the currently playing song for the lyrics search
          searchQuery = `${nowPlaying.artist} ${nowPlaying.title}`;
        } else {
          // Use the provided query
          searchQuery = query;
        }
  
        // Search for the lyrics
        const lyrics = await distify.lyrics(searchQuery);
  
        if (!lyrics) {
          return await interaction.reply('Lyrics not found.');
        }
  
        // Check if lyrics exceed 2000 characters
        if (lyrics.length > 2000) {
          // Create a Buffer with the lyrics and send as a .txt file
          const lyricsBuffer = Buffer.from(lyrics, 'utf-8');
          
          await interaction.reply({
            content: '🎤 Lyrics are too long, see the file:',
            files: [{
              attachment: lyricsBuffer,
              name: 'lyrics.txt'
            }]
          });
        } else {
          // Send lyrics normally if under 2000 characters
          await interaction.reply(`🎤 Lyrics:\n${lyrics}`);
        }
      } catch (error) {
        await interaction.reply('❌ Error fetching lyrics.');
        console.error(error);
      }
    }
  });

  // Event fired when a song starts playing
  distify.on('playSong', ({ track }) => {
    const { title, artist, url, duration, source, likes, thumbnail, member, textChannel, guildId } = track;
    textChannel.send(`🎶 Now playing: **${artist} - ${title}** added by **${member.displayName}**`);
  });

  // Event fired when a song is added to the queue
  distify.on('addSong', ({ track }) => {
    const { title, artist, url, duration, source, likes, thumbnail, member, textChannel, guildId } = track;
    textChannel.send(`🎵 Song **${artist} - ${title}** added to queue by **${member.displayName}**`);
  });

  // Event fired when the queue finishes
  distify.on('finishQueue', ({ track }) => {
    track.textChannel.send('🔚 Music queue finished.');
  });

  // Event fired when the queue becomes empty
  distify.on('emptyQueue', ({ track }) => {
    track.textChannel.send('I was waiting, no more songs were added to the queue, so I am leaving...');
  });

  // Event fired when the client disconnects from the voice channel
  distify.on('clientDisconnect', () => {
    console.log('👋 Disconnected from the voice channel.');
  });

  // Event fired when there is an error in the player
  distify.on('playerError', () => {
    console.log('Error');
  });

  // Log in to Discord with the bot token
  await client.login(clientToken);

  /* Uncomment this section for additional error handling
  process.on("unhandledRejection", async (reason, promise) => {
    console.log("[AntiCrash] | [UnhandledRejection_Logs] | [start] : ===============");
    console.log("Unhandled Rejection at:", promise, "reason:", reason);
    console.log("[AntiCrash] | [UnhandledRejection_Logs] | [end] : ===============");
  });

  process.on("uncaughtException", async (err, origin) => {
    console.log("[AntiCrash] | [UncaughtException_Logs] | [Start] : ===============");
    console.log(`Uncaught exception: ${err}\n` + `Exception origin: ${origin}`);
    console.log("[AntiCrash] | [UncaughtException_Logs] | [End] : ===============");
  });

  process.on("uncaughtExceptionMonitor", async (err, origin) => {
    console.log("[AntiCrash] | [UncaughtExceptionMonitor_Logs] | [Start] : ===============");
    console.log(`Uncaught exception monitor: ${err}\n` + `Exception origin: ${origin}`);
    console.log("[AntiCrash] | [UncaughtExceptionMonitor_Logs] | [End] : ===============");
  });
  */
}

// Start the main function and handle errors
main().catch(console.error);