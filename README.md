<p align="center">
  <img src="" width="600px" height="500px" alt="distify" align="center">
</p>
<p align="center">
  <a href="https://nodei.co/npm/distify/"><img src="https://nodei.co/npm/distify.png"></a>
</p>

# Distify - Npm API

## 📃 Documentação

[Leia a documentação aqui!](#)

## O que é Distify?

Distify é uma API npm que oferece ferramentas para adicionar e reproduzir músicas diretamente do Spotify e SoundCloud em servidores do Discord. Com o Distify, você pode pesquisar, reproduzir, pausar, retomar, pular e parar músicas, além de controlar o volume e buscar letras.

Para verificar as atualizações mais recentes, confira nossas [Notas de atualizações](#).

> ⚙️ Se você está tendo problemas durante a instalação ou uso do Distify, verifique [aqui](https://discord.gg/wV2WamExr5) para soluções.

### AVISO: Este package está em desenvolvimento, então pode ter uns bugs. Entre em nosso Discord para receber dicas, relatar ou dar sugestões.

> ### Dica:
Caso queira usar um exemplo, tem um arquivo test.js no nosso github onde você pode ter um exemplo mais detalhado.

## 🛠️ Como instalar?

Para instalar o módulo `distify`, abra um terminal ou shell e digite o seguinte código.

Para **npm** no seu terminal ou shell:
```console
npm install distify
```

## Como configurar?
Para usar o Distify, você precisa configurar a classe **DistifyClient** com suas credenciais do Spotify e as opções do player.

```js
const { Client, GatewayIntentBits } = require('discord.js');
const { DistifyClient } = require('distify');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const distify = new DistifyClient(client, {
  // Configurações da API
  configApi: {
    clientId: 'YOUR_SPOTIFY_CLIENT_ID',
    clientSecret: 'YOUR_SPOTIFY_CLIENT_SECRET'
  },
  // Configurações do player
  configPlayer: {
    defaultVolume: 75
  }
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login('YOUR_DISCORD_BOT_TOKEN');
```

## Como usar?

### Funções do player

- Pesquisar músicas

Você pode pesquisar músicas no Spotify e SoundCloud com o comando search.
```js
const tracks = await distify.search('Nome da música ou url do Spotify');
console.log(tracks);
```

- Tocar música

Para tocar uma música, use o comando play especificando o nome da música e o canal de voz.
```js
const channel = interaction.member.voice.channel;
await distify.play('Nome da música ou url do Spotify', channel);
```

- Controlar o player

Pausar música:
```js
distify.pause();
```

Retomar música:
```js
distify.resume();
```

Pular música:
```js
distify.skip();
```

Parar música:
```js
distify.stop();
```

Ajustar volume:
```js
distify.setVolume(50); // Volume entre 0 e 100
```

Obter a fila:
```js
const queue = distify.getQueue();
console.log(queue);
```

Tocar próxima música na fila:
```js
await distify.skip();
```

Para buscar as letras de uma música.
```js
const lyrics = await distify.lyrics('Nome da música ou artista');
console.log(lyrics);
```

Suporte
Servidor de suporte: [Kandaraku Community](https://discord.gg/wV2WamExr5)

Discord do desenvolvedor: cronegamesplays

Desenvolvido e criado por CroneGamesPlays | Kandaraku Studios © 2020 - 2024


Este README cobre a instalação, configuração e uso das principais funcionalidades da API Distify. Adapte os links e as informações de contato conforme necessário.