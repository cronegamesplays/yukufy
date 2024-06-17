const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');
const SpotifyWebApi = require('spotify-web-api-node');
const SoundCloud = require('soundcloud-scraper');
const scdl = require('soundcloud-downloader').default;
const sodium = require('libsodium-wrappers');
const { lyricsExtractor } = require('@discord-player/extractor');
require('discord-player');

(async () => {
  await sodium.ready;
})();

class DistifyClient {
  constructor(client, { configApi, configPlayer }) {
    this.client = client;
    this.configApi = configApi;
    this.configPlayer = configPlayer;

    this.volume = configPlayer.defaultVolume;

    this.spotifyApi = new SpotifyWebApi({
      clientId: configApi.clientId,
      clientSecret: configApi.clientSecret
    });

    this.soundcloudClient = new SoundCloud.Client();
    this.soundcloudClientId = SoundCloud.keygen();
    this.lyricsFinder = lyricsExtractor();

    this.player = createAudioPlayer();
    this.authenticateSpotify();

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.playNext();
    });

    this.player.on('error', error => {
      console.error('Erro no player:', error);
      this.playNext();
    });

    this.queue = [];
    this.currentResource = null;
    this.currentTrack = null; // Armazena a música atual
    this.loop = false; // Flag para controlar o loop
  }

  async authenticateSpotify() {
    try {
      const data = await this.spotifyApi.clientCredentialsGrant();
      this.spotifyApi.setAccessToken(data.body['access_token']);
    } catch (error) {
      console.error('Erro ao autenticar no Spotify:', error);
    }
  }

  async search(query) {
    try {
      const data = await this.spotifyApi.searchTracks(query);
      return data.body.tracks.items.map(track => ({
        title: track.name,
        artist: track.artists[0].name, // Adicionando o artista para melhorar a pesquisa no SoundCloud
        url: track.external_urls.spotify,
        duration: track.duration_ms
      }));
    } catch (error) {
      console.error('Erro ao buscar músicas:', error);
      throw new Error('Erro ao buscar músicas');
    }
  }

  async play(query, channel) {
    try {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator
      });

      connection.subscribe(this.player);

      const searchResultSy = await this.search(query);
      if (!searchResultSy.length) throw new Error('Nenhuma música encontrada');

      const track = searchResultSy[0];
      const scInfo = await scdl.search({
        query: `${track.title} ${track.artist}`,
        limit: 10, // Aumentar o limite para mais resultados e melhorar a filtragem
        resourceType: 'tracks',
        client_id: this.soundcloudClientId
      });

      if (!scInfo.collection.length) throw new Error('Nenhuma correspondência encontrada no SoundCloud');

      // Filtrar resultados para encontrar a música exata
      const scTrack = scInfo.collection.find(t => {
        return t.title.toLowerCase().includes(track.title.toLowerCase()) &&
               t.user.username.toLowerCase().includes(track.artist.toLowerCase()) &&
               !t.title.toLowerCase().includes('remix') &&
               !t.title.toLowerCase().includes('cover');
      });

      if (!scTrack) throw new Error('Nenhuma correspondência exata encontrada no SoundCloud');

      const song = await this.soundcloudClient.getSongInfo(scTrack.permalink_url);
      const scStreamUrl = await song.downloadProgressive();

      const resource = createAudioResource(scStreamUrl, { inlineVolume: true });
      let convertedVolume = this.volume / 100;
      if (this.volume === 0) {
        convertedVolume = 0.0;
      } else if (this.volume === 100) {
        convertedVolume = 1.0;
      }
      resource.volume.setVolume(convertedVolume);

      // Armazena apenas a URL e informações básicas
      this.queue.push({ url: scStreamUrl, title: track.title, spotifyUrl: track.url });

      if (this.player.state.status === AudioPlayerStatus.Idle) {
        this.playNext();
      }

      connection.on(VoiceConnectionStatus.Disconnected, () => {
        connection.destroy();
      });

    } catch (error) {
      console.error('Erro ao tocar música:', error);
      throw new Error('Erro ao tocar música');
    }
  }

  async playNext() {
    if (this.queue.length > 0) {
      const nextTrack = this.queue.shift();
      const resource = createAudioResource(nextTrack.url, { inlineVolume: true });
      let convertedVolume = this.volume / 100;
      if (this.volume === 0) {
        convertedVolume = 0.0;
      } else if (this.volume === 100) {
        convertedVolume = 1.0;
      }
      resource.volume.setVolume(convertedVolume);

      this.currentResource = resource;
      this.currentTrack = nextTrack;

      // Verifica se há loop configurado na música
      if (this.loop && this.currentTrack.loop) {
        // Se estiver em loop, re-adiciona a música na fila apenas se já não estiver lá
        if (!this.queue.find(item => item.url === this.currentTrack.url)) {
          this.queue.push({ url: this.currentTrack.url, title: this.currentTrack.title, spotifyUrl: this.currentTrack.spotifyUrl });
        }
      }

      this.player.play(this.currentResource);
      //console.log(`Tocando: ${nextTrack.title}`);
    } else {
      this.currentResource = null;
      this.currentTrack = null;
      //console.log('A fila está vazia.');
      // Emitir mensagem ou fazer ação quando a fila estiver vazia
    }
  }

  stop() {
    try {
      this.queue = [];
      this.player.stop();
      this.currentTrack = null;
      //console.log('Música parada.');
    } catch (error) {
      console.error('Erro ao parar música:', error);
      throw new Error('Erro ao parar música');
    }
  }

  skip() {
    try {
      if (this.queue.length > 0) {
        this.playNext();
        //console.log('Música pulada.');
      } else {
        //console.log('Não há mais músicas para pular a atual.');
        this.stop();
      }
    } catch (error) {
      console.error('Erro ao pular música:', error);
      throw new Error('Erro ao pular música');
    }
  }

  pause() {
    try {
      this.player.pause();
      //console.log('Música pausada.');
    } catch (error) {
      console.error('Erro ao pausar música:', error);
      throw new Error('Erro ao pausar música');
    }
  }

  resume() {
    try {
      this.player.unpause();
      //console.log('Música retomada.');
    } catch (error) {
      console.error('Erro ao retomar música:', error);
      throw new Error('Erro ao retomar música');
    }
  }

  setVolume(volume) {
    try {
      if (volume < 0 || volume > 100) {
        throw new Error('O volume deve estar entre 0 e 100.');
      }

      let convertedVolume = volume / 100;
      if (volume === 0) {
        convertedVolume = 0.0;
      } else if (volume === 100) {
        convertedVolume = 1.0;
      }

      this.volume = convertedVolume;

      if (this.currentResource) {
        this.currentResource.volume.setVolume(this.volume);
      }

      //console.log(`Volume ajustado para: ${volume}`);
    } catch (error) {
      console.error('Erro ao ajustar o volume:', error);
      throw new Error('Erro ao ajustar o volume');
    }
  }

  async playPlaylist(playlistId, channel) {
    try {
      const data = await this.spotifyApi.getPlaylistTracks(playlistId);
      const tracks = data.body.items.map(item => ({
        title: item.track.name,
        url: item.track.external_urls.spotify,
        duration: item.track.duration_ms
      }));

      for (const track of tracks) {
        await this.play(track.title, channel);
      }
    } catch (error) {
      console.error('Erro ao tocar playlist:', error);
      throw new Error('Erro ao tocar playlist');
    }
  }

  getQueue() {
    return this.queue.map((track, index) => ({
      position: index + 1,
      title: track.title
    }));
  }

  join(channel) {
    try {
      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator
      });

      connection.subscribe(this.player);

      connection.on(VoiceConnectionStatus.Disconnected, () => {
        connection.destroy();
        this.queue = []; // Limpa a fila ao desconectar
        this.currentTrack = null;
        this.currentResource = null;
        //console.log('Conexão de voz desconectada.');
      });

      return connection;
      } catch (error) {
      console.error('Erro ao entrar no canal de voz:', error);
      throw new Error('Erro ao entrar no canal de voz');
      }
      }

      leave() {
      try {
      const guildId = this.client.guilds.cache.first().id; // Obtém o ID do primeiro guild (ajuste conforme necessário)
      const connection = getVoiceConnection(guildId);
      if (connection) {
        connection.destroy();
        this.player.stop();
        this.queue = [];
        this.currentTrack = null;
        this.currentResource = null;
        //console.log('Saiu do canal de voz.');
      } else {
        //console.log('Não há conexão de voz para sair.');
        return;
      }
      } catch (error) {
      console.error('Erro ao sair do canal de voz:', error);
      throw new Error('Erro ao sair do canal de voz');
      }
      }

      toggleLoop() {
      this.loop = !this.loop;
      //console.log(`Loop ${this.loop ? 'ativado' : 'desativado'}`);

      // Se o loop estiver ativado e houver uma música atual tocando, configure para repetir infinitamente
      if (this.loop && this.currentTrack) {
      // Salva a configuração de loop na música atual
      this.currentTrack.loop = true;
      // Adiciona a música atual de volta à fila
      this.queue.push({ url: this.currentTrack.url, title: this.currentTrack.title, spotifyUrl: this.currentTrack.spotifyUrl });
      }
      }

      nowPlaying() {
      return this.currentTrack ? this.currentTrack : null;
      }

      async lyrics(query) {
      try {
      const lyrics = await this.lyricsFinder.search(query).catch(() => null);
      return lyrics ? lyrics.lyrics : null;
      } catch (error) {
      console.error('Erro ao buscar letras:', error);
      throw new Error('Erro ao buscar letras');
      }
      }
      }

module.exports = DistifyClient;