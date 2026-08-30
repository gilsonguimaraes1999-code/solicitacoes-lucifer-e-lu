# Identidade visual, usuários e Kanban responsivo

## Objetivo

Corrigir a administração de contas e transformar a aplicação em uma experiência visual consistente com o projeto de referência `calculadora-loja-sg-main`, sem alterar as regras centrais do quadro de solicitações.

## Diagnóstico confirmado

- A API administrativa usa o cliente `service_role` para ler e atualizar `profiles` e `user_permissions`.
- As migrations atuais concedem acesso apenas ao papel `authenticated`; as consultas administrativas não verificam os erros retornados pelas duas tabelas.
- Como consequência, a lista combina usuários do Auth com perfis vazios, exibe nomes e status ausentes, zera os contadores por status e falha ao aprovar ou editar.
- O quadro usa colunas de 320px com `shrink-0` dentro de um contêiner `overflow-x-auto`, desperdiçando largura em telas grandes e espremendo as ações das listas personalizadas.

## Direção visual aprovada

O ZIP fornecido é a referência visual oficial. A aplicação adotará:

- fundo preto profundo com estrelas e detalhes dourados;
- fundo vetorial dourado nas páginas internas;
- painéis escuros translúcidos com bordas discretas;
- tipografia Inter para conteúdo e Outfit para títulos;
- dourado como cor primária, mantendo verde, âmbar e vermelho para estados semânticos;
- ativo `angel-a.png` como marca e favicon;
- identidade textual própria de “Solicitações”, sem copiar regras ou conteúdo funcional da calculadora.

Os ativos visuais serão copiados para `public/`. O fundo animado respeitará `prefers-reduced-motion` e não bloqueará interação.

## Administração de usuários

A página será reorganizada como “Usuários e permissões”:

- cabeçalho compacto e botão “Nova conta”;
- pesquisa por nome ou e-mail, limpeza rápida e ordenação alfabética;
- filtros por status com contadores corretos;
- lista/tabela responsiva com nome, e-mail, perfil e status;
- botão de edição que abre um modal;
- modal com nome, status de aprovação e permissões individuais;
- owner permanece aprovado e com todas as permissões nativas;
- criação de conta passa a ocorrer em modal separado;
- atualizações mostram estado de processamento, sucesso e erro junto à ação;
- a lista é atualizada imediatamente após salvar e continua sincronizada via Realtime.

No servidor, uma migration concederá ao `service_role` os acessos necessários a `profiles` e `user_permissions`. A API passará a validar todos os erros de leitura e escrita, preservar a proteção da conta owner e retornar mensagens úteis sem expor dados sensíveis.

## Kanban responsivo

O quadro deixará de usar rolagem horizontal como layout padrão:

- o conteúdo usará toda a largura útil da janela;
- as listas serão distribuídas em uma grade responsiva com largura mínima confortável;
- quando não couberem lado a lado, quebrarão para a linha seguinte e a página rolará verticalmente;
- Pendente, Em progresso e Concluído continuarão fixas e aparecerão antes das listas de responsáveis;
- ações de listas personalizadas ficarão em um menu compacto `•••`;
- “Adicionar outra lista” será um bloco da própria grade;
- cartões e formulários continuarão funcionais em desktop e celular.

## Arquitetura e dados

- O projeto permanece em Next.js e Supabase.
- Nenhuma tabela existente será recriada e nenhum dado será apagado.
- A migration será aditiva e idempotente.
- O fluxo de aprovação continuará limitado ao owner aprovado.
- As permissões existentes de solicitações e gerenciamento de colunas serão preservadas.

## Tratamento de erros

- Falhas de carregamento terão estado visível e ação de tentar novamente.
- A API diferenciará entrada inválida, falta de autorização, registro inexistente e falha de persistência.
- O modal permanecerá aberto em caso de erro para que os dados não sejam perdidos.
- A interface impedirá envios repetidos enquanto uma operação estiver em andamento.

## Validação

- testes unitários de rotas administrativas cobrindo leitura, aprovação, edição, permissões e erros do banco;
- testes de componentes cobrindo filtros, modal e submissões;
- testes do Kanban confirmando grade responsiva e menu de ações;
- lint, typecheck, suíte completa e build de produção;
- inspeção visual local de login, usuários e dashboard em larguras desktop e móvel;
- aplicação da migration no Supabase, publicação no GitHub e verificação do deploy Vercel.
