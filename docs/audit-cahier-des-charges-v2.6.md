# JSB Manager — Écart cahier des charges V2.6 / GitHub

Date de revue : 21 novembre 2026  
Référence : `JSB_Manager_Cahier_des_charges_Judo_Taiso_2026-11-21_V2.6.docx` (bibliothèque projet).  
Base GitHub : `main`, commit de référence du cahier `52f69afd7869391bcbf6d61515e1af38fb62c4a0`.

> Ce fichier est une **feuille de recette et de migration**, pas une attestation que l'application satisfait déjà les critères. Les branches de travail et PR ouvertes ne sont pas livrées sur `main`.

## Périmètre non négociable

- Judo et Taïso sont deux disciplines avec objectifs, niveaux, règles de sélection et prescriptions propres.
- Exercices, fiches techniques et séances ont des types distincts ; aucune fiche Technique ne peut combler une carence du générateur.
- Modes de prescription : répétitions, durée et combiné lorsque pédagogiquement autorisé ; changements exercice par exercice sans écraser les autres dosages.
- Les illustrations historiques restent suspendues. Le catalogue privé n'est pas présumé importé.
- « Moniteur JSB », ses minuteurs et son audio sont hors périmètre.
- Données stockées localement ; aucune promesse de synchronisation cloud ou de Dynamic Island native.

## Écarts et décisions de livraison

| Priorité | Sujet | Constat vérifiable | Critère d'acceptation |
| --- | --- | --- | --- |
| P0 | Protection des brouillons | Contrat décrit au CDC, à recetter sur la version combinée | AC-38, 42, 46, 47 : aucun abandon, retour ou enregistrement échoué n'efface le travail |
| P0 | Séparation fiche Technique / Exercice | Contrôle métier à préserver | AC-40 : une fiche Technique ne peut être proposée ni ajoutée comme exercice |
| P0 | Judo Éveil 4–5 ans | Narration Tora dans PR #53, non livrée | AC-41 : apprentissage ludique adapté ; aucune opposition libre ni prescription inadaptée |
| P0 | Taïso collectif/individuel | Cohabitation des dosages à recetter | AC-43/44 : durée et répétitions coexistent ; modification d'une ligne sans altérer ses voisines |
| P0 | Catalogue/import Taïso | PR #54, #56, #59 en brouillon ; aucune importation réelle prouvée | AC-57 à 59 : précontrôle, refus de collision, confirmation, zéro écriture après annulation, restauration sûre |
| P0 | Supervision et restrictions | PR #51 reprise dans #59, non fusionnée | Interdiction par défaut des exercices supervisés ; autorisation explicite non persistante ; 27 exclusions non levées |
| P1 | Interface unifiée | PR #48–50 regroupées par #55, puis #57 | États vides accessibles, typographie harmonisée, « Suivi et reprise : En préparation » |
| P1 | Retour glissé vers la droite | PR #52 intégrée pour recette dans #57 | AC-39, 46, 50–52, 55 : même retour que le bouton ; aucun conflit avec modal, curseur ou contenu éditable |
| P1 | Accessibilité | Contrat V2.6 à mesurer, non certifié | AC-54–56 : Système/Clair/Foncé, focus clavier, réduction des mouvements, zones sûres iOS |
| P1 | Historique / planning | Recherche et distinction des créneaux à recetter | AC-36/37/49 : horaire fiable, filtres et page conservés, aucune attribution ambiguë |
| P2 | Suivi et reprise | Fonction non livrée | AC-60 : libellé « En préparation » ; aucune donnée de progression fictive |
| P2 | Médias et offline | Vérification réelle PWA nécessaire | AC-48, 56, 58 : présence de consignes même si médias manquent ; diagnostic hors ligne véridique |

## Graphe des PR — éviter les doubles fusions

- **UI** : #48 + #49 + #50 → #55 (consolidation) → **#57** (recette du retour tactile #52). La PR #57 cible la branche #55, **pas** `main`. Vérifier et fusionner par dépendances uniquement après les tests.
- **Taïso** : #51 + #54 + #56 → **#59** (recette combinée). Ne pas fusionner les trois sources puis leur intégration sans une analyse du diff.
- **Judo Éveil** : **#53** indépendante ; vérifier l'adéquation pédagogique et la non-régression des séances classiques avant toute intégration.
- Ne pas interpréter « mergeable » comme une recette réussie. Les PR ouvertes ne modifient pas la version publiée.

## Ordre d'exécution

1. **Geler un état de référence** : relever SHA `main`, sauvegarde locale représentative, jeux de données anonymisés, état du service worker. Ne pas importer de catalogue de production.
2. **Recetter #59 isolément** : CI complète + vrai fichier Taïso V46 (20 fiches à vérifier ; contrôle 244 entrées NON_IMPORT), collisions, 27 exclusions maintenues, autorisation de supervision, restauration et annulation d'import. L'ancien pilote V34 (5 puis 223) est historique, pas une preuve pour V46.
3. **Recetter #57 isolément** : clavier, focus, scroll, recherche, retour depuis fiche, fenêtres, swipe, iOS Safari/PWA portrait et paysage.
4. **Tester les contraintes pédagogiques** sur séances Éveil, Poussins, Benjamins+, Taïso collectif/individuel, fiche manquante et catalogue insuffisant ; documenter toute anomalie.
5. **Vérifier #53** séparément en Judo Éveil, y compris PDF, brouillon sauvegardé et usage hors ligne ; les 24 associations narratives restent à valider.
6. **Fusionner progressivement** après accord et preuves, en conservant les branches sources tant que leur diff n'a pas été couvert par une branche d'intégration. Réexécuter tests/recette après chaque fusion.
7. **Terminer les manques non couverts** par les PR en correctifs courts : préférences d'accessibilité, états de sauvegarde véridiques, conservation des filtres, formats de dosage, statut suivi, et tests correspondants.

## Matrice de recette minimale

- `node --test tests/*.test.cjs` : aucun échec sur la branche exacte à fusionner.
- AC-36 à AC-60 : marquer **PASS / FAIL / BLOQUÉ**, ajouter appareil, version, date et preuve. Aucun PASS déclaré sans exécution.
- Safari iPhone : navigateur + PWA installée ; portrait + paysage ; clavier visible ; mode avion ; retour tactile et bouton ; fermeture/reprise.
- Cas d'erreur : stockage saturé ou échec simulé, catalogue vide, exercice supprimé, import annulé, média inaccessible, conflit de références, sauvegarde chiffrée incorrecte.
- Aucune validation commerciale ou pédagogique automatique sur la seule présence d'une fiche, d'une PR ou d'un test unitaire.

## Conditions de sortie

**GO** seulement si : données conservées, cohérence pédagogique validée, CI verte sur branche combinée, vérifications Safari/PWA réelles faites, import V46 contrôlé avant tout lot, et revue de diff sans doublons. Sinon **NO GO** ; laisser la PR en brouillon et `main` inchangée.

## Limite de cet apport

Ce document ajoute un plan d'implémentation vérifiable sur une branche GitHub. Il **ne modifie pas encore l'interface exécutée**, ne fusionne aucune PR et ne prétend pas avoir testé le matériel de l'utilisateur.
