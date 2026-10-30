# AFK Bot Mine V2

Painel web mobile-first para gerenciar um bot Minecraft Java ou Bedrock em servidores compatíveis.

## Recursos
- Adaptador Java com Mineflayer e adaptador Bedrock com bedrock-protocol.
- Host, porta, nome, versão e autenticação configuráveis.
- Reconexão automática e logs.
- Interface mobile com abas inferiores: Início, Bots, Logs e Ajustes.
- API protegida por ADMIN_TOKEN, com sessão HttpOnly para dispensar digitação manual.

## Execução local
Node.js 20 ou superior (22 recomendado). Configure ADMIN_TOKEN e ACCESS_KEY no ambiente, execute npm install e npm start. Abra /access/SEU_ACCESS_KEY para autenticar o navegador; o servidor grava um cookie HttpOnly e redireciona para o painel.

## Render
Configure ADMIN_TOKEN e ACCESS_KEY como variáveis secretas do serviço. O link privado de acesso é https://SEU-SERVICO.onrender.com/access/SEU_ACCESS_KEY. Não compartilhe esse link: ele funciona como uma chave de acesso. Para revogar links antigos, troque ACCESS_KEY no Render. A sessão do navegador expira em 30 dias; limpe os cookies do site para sair antes disso.

O plano gratuito pode suspender serviços sem tráfego e não garante funcionamento 24/7.

## Segurança e compatibilidade
A API continua protegida. O link privado entrega um cookie HttpOnly, Secure e SameSite=Strict; não há token no JavaScript nem campo para digitá-lo. Offline só funciona quando o servidor permite. Microsoft pode exigir autenticação adicional; nunca coloque senha Microsoft neste painel. Use bots somente em servidores onde isso seja permitido.

## API
Todas as rotas /api exigem sessão autenticada ou Authorization: Bearer ADMIN_TOKEN.
- GET /health: saúde pública.
- GET /api/status: estado.
- GET /api/logs: registros recentes.
- POST /api/connect: inicia conexão.
- POST /api/disconnect: encerra conexão.

## Testes
Execute npm test.

## Limitações
- Uma conexão por instância.
- Configurações não persistem após reiniciar.
- Adaptador Bedrock básico precisa de teste em servidor real autorizado.
- Nenhum movimento automático é habilitado por padrão.

## Controles e automações

O painel inclui controle por toque (frente, trás, esquerda, direita, pulo, corrida e agachar), envio de mensagens, seguir jogador com navegação por caminhos no Java, reconexão automática, renascimento, alimentação automática, armadura e escudo automáticos.

**Compatibilidade atual:** Java oferece os controles e as automações avançadas. Bedrock oferece envio de chat e reconexão automática; movimento e automações de inventário ficam desativados para não enviar pacotes incompatíveis.

O seguidor Java usa Mineflayer Pathfinder com quebra de blocos, torres 1x1 e parkour desativados. O auto-comer evita alimentos conhecidos por causar efeitos negativos. O auto-equipar procura peças de armadura e escudo no inventário; troca a armadura somente quando a peça encontrada tem classificação de material superior, e só usa a mão secundária quando está livre.

As opções ficam guardadas na sessão ativa do bot. Ao reiniciar o serviço do Render, será necessário conectar novamente.
