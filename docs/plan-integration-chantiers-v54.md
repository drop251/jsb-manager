# JSB Manager — plan d'intégration des chantiers ouverts (21 novembre 2026)

## Objet
Les PR en cours ont chacune leurs propres contrôles CI, mais elles partent de branches séparées. **Une CI verte sur une PR ne valide pas leur combinaison**. Cette note encadre la livraison de la consolidation d'interface #55 sans écraser les développements simultanés.

## État constaté
| PR | Domaine | Fichiers communs à d'autres PR ouvertes | État au contrôle |
| --- | --- | --- | --- |
| #51 | Contraintes Taïso (supervision, niveau Expert, matériel) | `index.html`, `tests/catalogue.test.cjs` | Ouverte, brouillon, CI verte sur tête consultée |
| #52 | Retour tactile V2.7 | `index.html`, `sw.js`, `tests/catalogue.test.cjs` | Ouverte, brouillon, CI verte sur tête consultée |
| #53 | Éveil Judo : Tora | `index.html`, `sw.js`, `tests/catalogue.test.cjs` | Ouverte, brouillon, CI verte sur tête consultée |
| #54 | Import Taïso : prévisualisation et collisions | `index.html`, `sw.js`, `tests/catalogue.test.cjs` | Ouverte, brouillon, CI verte sur tête consultée |
| #55 | Consolidation interface #48, #49 et #50 | `index.html`, `sw.js`, `tests/catalogue.test.cjs` | Ouverte, brouillon ; 125 tests verts au commit `c6a7dcf` |
| #56 | Recette pilote Taïso et rapports | `tests/catalogue.test.cjs` | Ouverte, brouillon, CI verte sur tête consultée |

**Important :** « Fichiers communs » indique un risque d'intégration, pas un conflit Git démontré. L'état des PR et de leurs commits peut évoluer : vérifier leur tête juste avant chaque fusion.

## Ordre d'intégration proposé
1. **Stabiliser et valider #55**, y compris les parcours Safari/iPhone UI-01 à UI-14 ; ne pas fusionner #48, #49 et #50 séparément si #55 contient l'intégralité de leurs changements.
2. **Rebaser / mettre à jour #52** sur la base intégrant #55 et reprendre la recette tactile (retour à droite, défilement vertical, carrousels, champs et écrans superposés). Ne pas se contenter de la suite JS.
3. **Réconcilier #51 et #54** sur une branche d'intégration temporaire : préserver les règles de supervision Taïso et l'import avec aperçu/confirmation ; vérifier les références, exclusions et non-régression des catalogues sans écrire de données réelles pendant le test.
4. **Intégrer #56 uniquement après avoir aligné son contrat et ses scripts sur l'import réellement retenu**. Ses rapports de recette ne valent pas autorisation d'import automatique.
5. **Intégrer #53 séparément**, après validation de la séparation des univers Judo/Taïso, des contraintes Éveil 4–5 ans et des contenus Tora. Ne pas introduire d'images non autorisées.

Cet ordre est un **plan de travail**, non un ordre de fusion automatique ; il doit être réévalué si de nouvelles PR arrivent ou si les dépendances changent.

## Contrôles après chaque combinaison
- Vérifier les différences et résoudre manuellement les sections concurrentes de `index.html` ; ne jamais choisir « ours/theirs » pour tout le fichier.
- Unifier les noms de cache `sw.js`, vérifier sa stratégie de mise à jour et l'absence de références à une ancienne version.
- Ne garder qu'une seule implémentation de chaque changement commun dans `tests/catalogue.test.cjs`.
- Exécuter `node --test tests/*.test.cjs` et vérifier que le nombre de tests et les cas métier attendus restent présents.
- Contrôler les flux de sauvegarde et reprise, les imports non destructifs, l'annulation du générateur, les modes durée/répétitions et les disciplines.
- Effectuer les essais Safari / PWA sur appareil, notamment swipe, focus et hors ligne.
- Documenter le SHA exact de la combinaison testée, le résultat CI et la décision de livraison.

## Garde-fous
- Ne pas modifier les séances ou catalogues utilisateurs pour « valider » une migration sans export restaurable.
- Aucun minuteur dans JSB Manager.
- Ne pas assimiler une PR individuellement « mergeable » et une CI verte à une recette de publication.
- Ne pas fermer les PR sources ni fusionner #55 sans revue finale et validation des scénarios bloquants.
