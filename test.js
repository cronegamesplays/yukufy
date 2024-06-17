const { Client, GatewayIntentBits, InteractionType, REST, Routes } = require('discord.js');
const { DistifyClient } = require('./index.js');

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages
  ]
});

const distify = new DistifyClient(discordClient, {
  configApi: {
    clientId: "Your_ClientId_SpotifyApplication",
    clientSecret: "Your_ClientSecret_SpotifyApplication"
  },
  configPlayer: {
    defaultVolume: 75
  }
});

const commands = [
  {
    name: 'play',
    description: 'Toca uma música no canal de voz',
    options: [
      {
        name: 'query',
        type: 3, // Tipo STRING
        description: 'Nome da música ou URL',
        required: true
      }
    ]
  },
  {
    name: 'stop',
    description: 'Para a música e sai do canal de voz'
  },
  {
    name: 'skip',
    description: 'Pula para a próxima música na fila'
  },
  {
    name: 'pause',
    description: 'Pausa a música atual'
  },
  {
    name: 'resume',
    description: 'Retoma a música pausada'
  },
  {
    name: 'volume',
    description: 'Ajusta o volume do player',
    options: [
      {
        name: 'level',
        type: 10, // Tipo NUMBER
        description: 'Volume entre 0 e 100',
        required: true
      }
    ]
  },
  {
    name: 'playlist',
    description: 'Toca uma playlist do Spotify',
    options: [
      {
        name: 'id',
        type: 3, // Tipo STRING
        description: 'ID da playlist do Spotify',
        required: true
      }
    ]
  },
  {
    name: 'queue',
    description: 'Mostra a fila de músicas'
  },
  {
    name: 'join',
    description: 'Entra no canal de voz'
  },
  {
    name: 'leave',
    description: 'Sai do canal de voz'
  },
  {
    name: 'loop',
    description: 'Alterna o modo de repetição'
  },
  {
    name: 'nowplaying',
    description: 'Mostra a música que está tocando agora'
  },
  {
    name: 'lyrics',
    description: 'Mostra as letras da música atual ou de uma música específica',
    options: [
      {
        name: 'query',
        type: 3, // Tipo STRING
        description: 'Nome da música (opcional)',
        required: false
      }
    ]
  }
];

const rest = new REST({ version: '10' }).setToken("Your_DiscordClient_Token");

async function main() {
  try {
    console.log('Iniciando o registro de comandos slash.');

    await rest.put(
      Routes.applicationCommands("1216138439972491324"),
      { body: commands }
    );

    console.log('Comandos slash registrados com sucesso.');
  } catch (error) {
    console.error('Erro ao registrar comandos slash:', error);
  }

  discordClient.once('ready', () => {
    console.log(`Logado como ${discordClient.user.tag}`);
  });

  discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    if (interaction.type !== InteractionType.ApplicationCommand) return;
	if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'play') {
    await interaction.deferReply();
    const query = options.getString('query');
    const channel = interaction.member.voice.channel;
    if (!channel) {
      await interaction.editReply({ content: 'Você precisa estar em um canal de voz para tocar música!' });
      return;
    }
    try {
      setInterval(() => {
        distify.play(query, channel);
      }, 3000);
      await interaction.editReply({ content: `🔊 Tocando agora: ${query}`, ephemeral: false });
    } catch (error) {
      await interaction.editReply('❌ Erro ao tocar música');
      console.error(error);
    }
  }

    if (commandName === 'stop') {
      distify.stop();
      await interaction.reply('🛑 Música parada.');
    }

    if (commandName === 'skip') {
      distify.skip();
      await interaction.reply('⏭️ Música pulada.');
    }

    if (commandName === 'pause') {
      distify.pause();
      await interaction.reply('⏸️ Música pausada.');
    }

    if (commandName === 'resume') {
      distify.resume();
      await interaction.reply('▶️ Música retomada.');
    }

    if (commandName === 'volume') {
      const volume = options.getNumber('level');
      try {
        distify.setVolume(volume);
        await interaction.reply(`🔊 Volume ajustado para: ${volume}`);
      } catch (error) {
        await interaction.reply('❌ Erro ao ajustar o volume');
        console.error(error);
      }
    }

    if (commandName === 'playlist') {
      const playlistId = options.getString('id');
      const channel = interaction.member.voice.channel;

      if (!channel) {
        await interaction.reply('Você precisa estar em um canal de voz para tocar música!');
        return;
      }

      try {
        await distify.playPlaylist(playlistId, channel);
        await interaction.reply(`🎶 Tocando playlist: ${playlistId}`);
      } catch (error) {
        await interaction.reply('❌ Erro ao tocar playlist');
        console.error(error);
      }
    }

    if (commandName === 'queue') {
      const queue = distify.getQueue();
      if (queue.length === 0) {
        await interaction.reply('A fila está vazia.');
      } else {
        const queueString = queue.map(track => `${track.position}. ${track.title}`).join('\n');
        await interaction.reply(`🎵 Fila de músicas:\n${queueString}`);
      }
    }

    if (commandName === 'join') {
      const channel = interaction.member.voice.channel;

      if (!channel) {
        await interaction.reply('Você precisa estar em um canal de voz para me convidar!');
        return;
      }

      try {
        await distify.join(channel);
        await interaction.reply(`🔊 Entrei no canal de voz: ${channel.name}`);
      } catch (error) {
        await interaction.reply('❌ Erro ao entrar no canal de voz');
        console.error(error);
      }
    }

    if (commandName === 'leave') {
      try {
        distify.leave();
        await interaction.reply('👋 Saí do canal de voz.');
      } catch (error) {
        await interaction.reply('❌ Erro ao sair do canal de voz');
        console.error(error);
      }
    }

    if (commandName === 'loop') {
      distify.toggleLoop();
      await interaction.reply(`🔄 Loop ${distify.loop ? 'ativado' : 'desativado'}`);
    }

    if (commandName === 'nowplaying') {
      const nowPlaying = distify.nowPlaying();
      await interaction.reply(nowPlaying ? `🎶 Tocando agora: ${nowPlaying.title}` : 'Nenhuma música tocando no momento.');
    }

    if (commandName === 'lyrics') {
      const query = options.getString('query');
      try {
        const lyrics = await distify.lyrics(query || distify.nowPlaying());
        await interaction.reply(lyrics ? `🎤 Letras:\n${lyrics}` : 'Letras não encontradas.');
      } catch (error) {
        await interaction.reply('❌ Erro ao buscar letras');
        console.error(error);
      }
    }
  });

  await discordClient.login('Your_DiscordClient_Token');
}

main().catch(console.error);
