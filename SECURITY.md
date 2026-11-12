# Segurança

Para reportar uma vulnerabilidade, **não abra uma issue pública**: use *Security → Report a vulnerability*
neste repositório ou escreva diretamente ao mantenedor.

## Modelo de proteção
- Dados do usuário ficam em `users/{uid}/…` no Firestore; as regras (`firestore.rules`) só permitem o próprio dono.
- Logout limpa `localStorage` e o cache offline do Firestore.
- Relatórios em PDF/HTML escapam todo texto do usuário e rodam sob CSP com nonce.
- Backups e CSVs importados são validados (tamanho, números finitos, cores, limites de lista).
- Nunca versionar chaves: `.env*` e arquivos de service account estão no `.gitignore`.
