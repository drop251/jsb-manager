# Vérification de livraison JSB Manager — 23 novembre 2026

## État contrôlé
- Branche de référence : `main`, commit `f3372e82cea2d8bde2c89d2673c210aaa730353e`.
- Intégrations : UX V2.6 / retour tactile / secours PWA via #61 ; protections Taïso V46 via #62.
- GitHub Actions : exécution principale `44903092691` réussie (suite `node --test tests/*.test.cjs`).
- GitHub Pages : exécution `44903092506` réussie.
- Tora Éveil Judo : PR #63 en brouillon ; exécution `44903511987` réussie, mais hors `main`.
- CI réussie ne signifie pas recette Safari, PWA installée, ni validation pédagogique.

## Garde-fous de cette mise à jour
- Vérifier que toutes les ressources déclarées dans le pré-cache PWA existent réellement.
- Refuser les doublons et la disparition des fichiers essentiels de navigation.
- Vérifier la syntaxe JavaScript des scripts de navigation, du service worker, des outils Taïso et de Tora lorsqu'il est présent.
- Ne modifier aucune fiche d'exercice, import, brouillon, séance ou donnée locale.

## Recette manuelle restant obligatoire avant validation fonctionnelle
1. Sur Safari iPhone et en PWA installée, ouvrir l'application avec réseau, puis la rouvrir hors ligne.
2. Vérifier retour tactile, navigation verticale, champs éditables, fenêtres de confirmation et changement clair/sombre.
3. Créer une séance Judo et une séance Taïso, enregistrer, quitter, reprendre et exporter les PDF.
4. Prévisualiser un import Taïso réel **sans le valider**, vérifier collisions de références, confirmation et annulation sans écriture.
5. Vérifier que les 27 exclusions restent bloquées ; ne pas importer les 244 lignes du contrôle NON_IMPORT.
6. Pour #63 : valider les consignes Tora par tranche d'âge, les droits du personnage, la sauvegarde et le PDF, puis seulement décider de la fusion.

## Décision
- Code automatique : **GO pour contrôle CI**, non équivalent à une validation terrain.
- Import de catalogue : **NO GO** sans fichiers sources vérifiés et recette contrôlée.
- Tora : **NO GO pour fusion en production** tant que les essais manuels et la revue pédagogique ne sont pas documentés.
