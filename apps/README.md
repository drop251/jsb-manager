# Deux applications, un dépôt

- `admin/` : point d'entrée de développement de l'administration.
- `public/` : point d'entrée de développement grand public (coach et particulier).
- `../index.html` : PWA historique locale conservée pour les recettes et la migration ; ne constitue pas une application multi-utilisateur sécurisée.
- `../modules/judo.js`, `../modules/taiso.js`, `../core/`, `../ui/` : briques existantes à mutualiser progressivement, sans duplication.

Les deux nouveaux points d'entrée sont des pages inactives, sans accès aux données, sans stockage ni inscription. Ils ne redirigent pas vers la PWA historique.
Les déploiements cibles utilisent des origines distinctes et des artefacts construits séparément. L'artefact grand public ne doit contenir ni interface d'administration ni backend ni fichiers privés.
Ne pas publier le dépôt entier comme solution de production. Le service worker historique doit ignorer ces nouvelles routes pour ne pas contaminer ses caches. Les futurs service workers auront des périmètres et caches indépendants.
La migration des données reste à concevoir et à tester ; aucune suppression automatique.
