# JSB Manager — Architecture modulaire et cible mobile
Statut : orientation approuvée, migration progressive à partir de V31.

## Principes
- Un point d'entrée web, une PWA et une identité graphique ; pas de duplication en deux applications.
- Moteurs métier Judo et Taïso indépendants. Services communs pour les licenciés, présences, stockage, sauvegardes et navigation.
- Aucun changement des données existantes, des clés de stockage ni des modèles PDF lors d'une extraction de module.
- Fonctionnement hors connexion : chaque ressource nécessaire doit être incluse dans le précache PWA et vérifiée en CI.
- Modules métier testables sans DOM ou interface. Préférer des dépendances système injectées et des interfaces explicites.
- Les exercices gardent leurs identifiants stables ; catalogue Judo et Tora non intégrés tant que non validés.

## V31 — Première brique
`core/stockage-web.js` : fabrique `creerStockage(env)`, méthodes lire, ecrire, ecrireLot, fermer, oublierAncien, ancien, proteger. Le contrat reste celui de l'application existante. Les accès IndexedDB, localStorage et navigator sont fournis par l'environnement. Base jsb-manager, table donnees, version 1 et mécanisme de secours inchangés.

## Cible mobile
Évaluer Capacitor en priorité pour réutiliser l'interface web ; décision définitive après prototype iOS/Android, tests de performances et vérification des exigences de publication.
Prévoir un adaptateur de persistance mobile (SQLite ou autre selon le prototype). Les préférences synchrones et le journal des préparations nécessiteront également une abstraction. Une migration explicite depuis les sauvegardes PWA devra être testée : les données de Safari ne se transfèrent pas automatiquement à une application native.

## Migration progressive
V31 : noyau de stockage (première extraction).
V32 : moteurs métier Judo et Taïso.
V33 : présences et licenciés.
V34 : catalogue, séances et sauvegardes.
V35 : consolidation modulaire, recette hors ligne et préparation au prototype mobile.

Chaque extraction doit être validée par les tests de fiabilité, les recettes PDF et navigateur, et le contrôle de fonctionnement hors connexion. Pas de publication native ni de migration des données réelles à ce stade.
