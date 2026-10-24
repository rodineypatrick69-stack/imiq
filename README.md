# Painel do Supervisor de Equipe

Painel responsivo de equipes TM, TT e TN. O estado compartilhado (equipe, escalas, folgas, ausências e diários) é persistido no Supabase independente `imiq`; não usa o projeto HPE.

## Stack e segurança

- Supabase Postgres: estrutura normalizada, estado do painel, auditoria e controle de tentativas.
- Supabase Auth: sessão de usuário do painel, iniciada por função Edge `supervisor-login`.
- RLS: leitura/gravação do estado somente para perfis ativos; credenciais e limites ficam reservados ao `service_role`.
- Vercel: build estático em `dist/vercel`; o pacote publicado não inclui dados iniciais ou arquivos de funcionários.

O login usa usuário e PIN curto conforme solicitado pelo supervisor. O PIN é validado no servidor usando PBKDF2-SHA-256 e há bloqueio temporário após cinco tentativas inválidas. Não salve PINs no repositório nem em variáveis do Vercel.

## Desenvolvimento e build

```sh
bash scripts/build.sh
node scripts/test-build.mjs
```

O HTML usa apenas a chave pública Supabase (`sb_publishable_…`), que pode estar no cliente. A chave `service_role` permanece exclusiva no ambiente Supabase e nunca deve ser colocada no código ou no Vercel. A função Edge usa os segredos padrão do Supabase.

## Deploy

O projeto Vercel `imiq` está ligado ao branch `main` do GitHub. Cada commit dispara o build configurado no `vercel.json`. Para manter outro projeto Supabase isolado, atualize o endereço/chave pública no app e faça o deploy da função e das migrações no projeto apropriado; nunca reutilize as credenciais do HPE.

As migrações versionam o esquema e as políticas; os dados operacionais são inseridos no banco privado, não no Git.
