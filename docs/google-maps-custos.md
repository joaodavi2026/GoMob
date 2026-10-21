### Integração com Google Maps Platform e Controle de Custos

O GoMob utilizará a **Google Maps Platform**, integrando a Maps JavaScript API para visualização interativa dos ônibus e a Routes API para cálculo e comparação de trajetos.

Inicialmente, o MVP terá uma estimativa de **450 requisições mensais**, priorizando o uso das franquias gratuitas disponibilizadas pelo Google Cloud.

O sistema contará com mecanismos de otimização, cache, monitoramento de consumo e controle de cotas para evitar requisições desnecessárias e reduzir custos.

A localização dos ônibus será obtida diretamente pela **API Olho Vivo da SPTrans**, permitindo atualizações automáticas sem realizar novas requisições de carregamento do mapa.

O projeto será desenvolvido com **Claude Code, GitHub e Vercel**, mantendo as chaves de API protegidas por variáveis de ambiente e respeitando os limites e as políticas de utilização dos serviços.

**Objetivo:** manter o custo operacional do MVP próximo de R$ 0, desde que o consumo permaneça dentro das franquias gratuitas aplicáveis, incluindo a categoria de faturamento utilizada para rotas de transporte público.
