# IMIQ — Controle pessoal

Versão 24 · 27/10/2026. Aplicação de supervisão das equipes TM, TT e TN, com login, escalas, diário operacional, cadastro de funcionários, folgas e ausências.

## Interface e arquitetura

- React + TypeScript em modo estrito; componentes reutilizáveis para botões, indicadores, campos, painéis e modais.
- Vite para desenvolvimento e build de produção; dependências fixadas e lockfile versionado.
- Ícones Lucide e fonte Inter hospedada no próprio build.
- Sistema visual roxo, preto, branco e laranja; menu lateral adaptável, tabelas com rolagem no celular, navegação por teclado e respeito a movimento reduzido.
- Busca de funcionários por nome, registro ou número pessoal; cadastro e edição, incluindo o número de folga de cada pessoa.
- O painel mostra apenas os funcionários cujo número de folga corresponde ao ciclo do dia, com esse número visível ao lado de cada nome. O número define a rotação futura de trabalho e descanso.

## Dados e acesso

O IMIQ usa exclusivamente o projeto Supabase `qedlkndcfzyqvintkvud`, separado do HPE. Esta atualização não altera o esquema, os usuários nem as credenciais existentes.

O login envia usuário e PIN à função Edge `supervisor-login`. Ela valida o PIN no servidor, limita tentativas e devolve uma sessão Supabase Auth. O frontend contém somente a chave pública publicável. Nenhum PIN, token de sessão ou chave de serviço deve ser salvo no Git.

`src/lib/api.ts` preserva o contrato REST existente. Leituras e gravações usam o token do usuário e as políticas RLS do banco. `workspace_states` permanece a fonte de verdade, com atualização condicionada à revisão para impedir sobrescritas concorrentes. A fila de gravação confirma cada revisão retornada pelo servidor; alterações feitas durante uma gravação entram na sequência. Em caso de erro, é possível tentar novamente e baixar backup. Conflitos interrompem a edição até a recarga explícita da nuvem. A consulta periódica ocorre a cada 15 segundos e não interrompe campos em edição.

A cópia local é apenas uma recuperação auxiliar. O indicador “Sincronizado” aparece depois da confirmação do servidor. Os dados reais não fazem parte do build. Os testes usam apenas dados fictícios.

## Desenvolvimento e validação

Requer Node 22.12+ ou 24.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

O build executa a verificação de tipos, os testes e a compilação. Os testes cobrem regras de cobertura, ausências, liderança, folgas, transferência com preservação do histórico, proteção de revisão, sessão e renovação de token.

- `src/components/`: componentes básicos e login.
- `src/pages/`: cinco telas de operação.
- `src/lib/domain.ts`: regras da escala e exportação CSV.
- `src/lib/useWorkspace.ts`: estado compartilhado e sincronização.
- `src/styles.css`: tokens, componentes e regras responsivas.
- `supabase/`: função e migrações já existentes, mantidas.
- `app/version.json`: versão da aplicação.

## Publicação

O projeto Vercel `imiq` (`prj_sawOmoyZL7qUqvoYzL9UXeTxsily`) acompanha `main` de `rodineypatrick69-stack/imiq`. Cada atualização nessa branch dispara o deploy automático. `vercel.json` configura `npm ci`, o build Vite, saída `dist/vercel`, política de conteúdo e cabeçalhos de segurança.

O HTML antigo e o worker legado foram substituídos pela aplicação React nesta versão. Esta publicação é destinada ao Vercel; o endereço antigo de Sites tem publicação independente. Para reverter, restaure o commit anterior no GitHub e deixe o Vercel reconstruir. Não apague o banco ou seus dados.
