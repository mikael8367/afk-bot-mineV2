# AFK Bot Mine V2

Painel web mobile-first para gerenciar um bot Minecraft Java ou Bedrock em servidores compatíveis.

## Recursos
- Adaptador Java com Mineflayer.
- Adaptador Bedrock com bedrock-protocol.
- Host, porta, nome, versão e autenticação configuráveis.
- Reconexão automática e logs.
- Interface adaptada para celular com abas inferiores: Início, Bots, Logs e Ajustes.
- API protegida por ADMIN_TOKEN.

## Requisitos e execução
Node.js 20 ou superior (22 recomendado).
1. Copie .env.example para .env.
2. Defina ADMIN_TOKEN com um segredo longo e aleatório.
3. Execute npm install e depois npm start.
4. Abra http://localhost:3000 e informe o token em Ajustes.

## Render
Importe o repositório como Web Service. Build: npm install. Start: npm start. Configure ADMIN_TOKEN nas variáveis de ambiente. O plano gratuito pode suspender serviços sem tráfego e não é adequado para garantir bot 24/7; confira os limites atuais do provedor.

## Autenticação e compatibilidade
Offline só funciona quando o servidor permite. Microsoft pode exigir interação de autenticação adicional no ambiente e ainda precisa de validação prática. Nunca coloque senha Microsoft no painel. Alguns servidores bloqueiam clientes automatizados; use apenas onde isso é permitido.

## API
Todas as rotas /api exigem Authorization: Bearer SEU_TOKEN.
- GET /health: saúde pública.
- GET /api/status: estado.
- GET /api/logs: registros recentes.
- POST /api/connect: inicia conexão.
- POST /api/disconnect: encerra conexão.

Exemplo de corpo:
{
  "edition":"java",
  "host":"play.example.net",
  "port":25565,
  "username":"AFKBot",
  "auth":"offline"
}
Para Bedrock, use edition bedrock e a porta UDP configurada pelo servidor (frequentemente 19132).

## Testes
Execute npm test.

## Limitações iniciais
- Uma conexão por instância.
- Configurações não persistem após reiniciar.
- Adaptador Bedrock básico e ainda precisa ser testado em servidor real autorizado.
- Nenhum movimento automático é habilitado por padrão.
