# PostgreSQL — inicialização sem importar SQLite

A partir desta versão, se `DATABASE_URL` estiver definida, a API utiliza o
PostgreSQL por `pg-native`/libpq. O backend atual mantém consultas síncronas em
vários módulos; uma camada de compatibilidade traduz parâmetros `?`, a
introspecção `PRAGMA table_info`, `INSERT OR IGNORE` e timestamps de `INTEGER`
para PostgreSQL. O PostgreSQL **não recebe dados do SQLite**.

## Ativar no Dokploy

1. Aponte `DATABASE_URL` para o banco PostgreSQL **vazio e exclusivo** do app,
   no formato `postgresql://usuario:senha@host:5432/banco`. Configure SSL
   conforme os requisitos do serviço; **não publique a URL em commits, logs ou
   screenshots**. A conta precisa de permissão para criar tabelas e índices.
2. Defina `APP_ENV=production`, `AUTO_SEED_DEMO=false` e mantenha
   `ENABLE_DEMO_USERS`/`ENABLE_DEMO_ADMIN` desativadas.
3. Garanta que o diretório `DATA_DIR=/data` continue persistente para a chave
   JWT e o segredo dos convites de amizade. PostgreSQL não exige salvar o
   `submundo.sqlite`, mas **não remova o volume antes do rollback**.
4. Suba **uma única instância** do backend para esta fase. O banco e as tabelas
   serão criados na primeira inicialização; o processo falha caso a conexão
   falhe. Consulte `GET /api/health` e efetue login/cadastro, eventos,
   mapas, produtos, notificações e permissão de localização.
5. Como o PostgreSQL começa vazio, cadastre a primeira conta pelo formulário.
   Depois conceda o papel de administrador apenas para o usuário esperado,
   por conexão administrativa no próprio PostgreSQL:

   ```sql
   INSERT INTO admin_users(user_id,created_at)
   SELECT id, (EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)::bigint
   FROM users WHERE email = 'administrador@exemplo.com'
   ON CONFLICT (user_id) DO NOTHING;
   ```

   **Confira quem controla o e-mail antes de executar o SQL**. Na modalidade
   PostgreSQL, `ADMIN_EMAIL` não atribui permissões automaticamente:
   cadastro de e-mail ainda não é verificado e não concede admin por si só.

6. Valide os fluxos do aplicativo nos navegadores reais, especialmente OAuth,
   push e filas de notificações. A CI usa banco PostgreSQL efêmero separado
   do banco da empresa.

## Rollback

Remova temporariamente a `DATABASE_URL` e volte à imagem anterior ou à
versão SQLite compatível, preservando o volume `/data`. Os dados criados no
PostgreSQL **não aparecerão automaticamente no SQLite**. Não faça rollback
sem avaliar dados novos se o sistema já estiver atendendo usuários reais.

## Limitações e próxima etapa

- Esta migração é uma **camada de compatibilidade síncrona** sobre a API Node
  existente, com **uma conexão PostgreSQL por processo**. Ela facilita um
  primeiro teste sem reescrever dezenas de módulos, mas consultas de rede
  bloqueiam temporariamente a thread HTTP. Para eventos grandes ou
  múltiplas réplicas, planeje refatorar o acesso ao banco para `pg` assíncrono,
  pool de conexões e transações explícitas antes de dimensionar carga.
- As migrações de schema são idempotentes para o banco vazio. Para ambientes
  com dados reais e mudanças futuras, adote scripts versionados de migração.
- `DATABASE_URL` ausente mantém o SQLite anterior, sem apagar ou migrar
  quaisquer dados automaticamente.
- Backups passam a ser de PostgreSQL (ex.: `pg_dump` com política de retenção,
  armazenamento externo e teste de restauração); não configure backups SQLite
  para o novo banco.
