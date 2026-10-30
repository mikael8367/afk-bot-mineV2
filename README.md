# AFK Bot Mine V2

Painel web mobile-first para gerenciar um bot Minecraft Java ou Bedrock em servidores compatíveis.

## Recursos
- Adaptador Java com Mineflayer e adaptador Bedrock com bedrock-protocol.
- Host, porta, nome, versão e autenticação configuráveis.
- Reconexão automática e logs.
- Interface mobile com abas inferiores: Início, Bots, Logs e Ajustes.
- API pública sem token; painel abre diretamente no navegador e no aplicativo.

## Execução local
Node.js 20 ou superior (22 recomendado). Execute npm install e npm start. O painel e a API ficam públicos, sem etapa de autenticação.

## Render
Não é necessário configurar ADMIN_TOKEN ou ACCESS_KEY. O painel abre pela URL normal do serviço.

O plano gratuito pode suspender serviços sem tráfego e não garante funcionamento 24/7.

## Segurança e compatibilidade
**Aviso:** a API é pública e não exige token. Qualquer pessoa que conheça a URL do serviço pode consultar o estado e tentar controlar o bot, inclusive conectar, desconectar e enviar mensagens. As rotas de escrita têm limite básico de 30 requisições por IP por minuto, mas isso não substitui autenticação. Não use esta configuração se precisar de controle privado. Offline só funciona quando o servidor permite. Microsoft pode exigir autenticação adicional; nunca coloque senha Microsoft neste painel. Use bots somente em servidores onde isso seja permitido.

## API
As rotas /api são públicas e não exigem sessão ou token. As rotas POST têm limite básico por IP.
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

## Seleção de versões Minecraft

O formulário carrega a lista de protocolos suportados pelos motores instalados. A opção **Detectar automaticamente** deixa o protocolo negociar a versão do servidor. Também é possível selecionar uma versão específica.

- **Java:** Mineflayer 4.39.x + minecraft-protocol 1.68.x; a lista é obtida de `minecraft-protocol.supportedVersions` em tempo de execução.
- **Bedrock:** bedrock-protocol 3.60.x; versões listadas: 1.16.201, 1.16.210, 1.16.220, 1.17.0, 1.17.10, 1.17.30, 1.17.40, 1.18.0, 1.18.11, 1.18.30, 1.19.1, 1.19.10, 1.19.20, 1.19.21, 1.19.30, 1.19.40, 1.19.41, 1.19.50, 1.19.60, 1.19.62, 1.19.63, 1.19.70, 1.19.80, 1.20.0, 1.20.10, 1.20.30, 1.20.40, 1.20.50, 1.20.61, 1.20.71, 1.20.80, 1.21.0, 1.21.2, 1.21.21, 1.21.30, 1.21.42, 1.21.50, 1.21.60, 1.21.70, 1.21.80, 1.21.90, 1.21.93, 1.21.100, 1.21.111, 1.21.120, 1.21.124, 1.21.130, 1.26.0, 1.26.10, 1.26.20, 1.26.30, 1.26.40, 1.26.45 e 1.26.51.
- Versões não listadas são recusadas pela API para evitar uma tentativa com protocolo incompatível. Quando uma nova versão sair, atualizar o motor e a lista é necessário; a opção automática não adiciona suporte a protocolos ausentes.

A lista Bedrock segue as versões anunciadas pelo pacote bedrock-protocol 3.60.1. O Java segue a lista dinâmica do minecraft-protocol instalado.
