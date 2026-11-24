# Recette utilisateur Safari / PWA — 24 novembre 2026

## Périmètre et provenance

- Version publique de référence lors de la recette : `main` 78967a15afaf827d73bafbcb9932970af13136e0 ; déploiement GitHub Pages 45414463839 réussi.
- Résultats déclarés par l'utilisateur le 24 novembre 2026 à 15 h 40 (Europe/Paris), via la checklist de recette. Appareil exact, version Safari et captures non fournis ; SHA de l'appareil non mesuré indépendamment.
- 11 contrôles déclarés réussis, aucun échec déclaré. Aucun accès distant à l'appareil ni validation exhaustive revendiqués.

| Contrôle | Résultat déclaré |
| --- | --- |
| Ouverture dans Safari | Réussi |
| Actualisation de la version installée | Réussi |
| Navigation entre sections | Réussi |
| Thème clair et sombre | Réussi |
| Préparation et enregistrement d'une séance | Réussi |
| Fermeture et réouverture | Réussi |
| Conservation de la séance | Réussi |
| Export PDF | Réussi |
| Activation du mode avion | Réussi |
| Réouverture depuis l'écran d'accueil | Réussi |
| Navigation hors ligne | Réussi |

## Recette automatisée distincte

- Tests de fiabilité de la version principale : run 45414464915 réussi.
- PR #67, run navigateur 45414852856 : échec de l'installation WebKit et Chromium sur le runner ubuntu-latest (26.04), non pris en charge par Playwright 1.56.1. Aucun test navigateur applicatif n'a été exécuté lors de ce run.
- Correctif : runner explicitement fixé à Ubuntu 24.04. Nouvelle exécution à vérifier ; aucun succès anticipé.

La recette manuelle couvre uniquement les scénarios ci-dessus ; elle ne certifie pas tous les cas limites du stockage, de l'import ou de l'accessibilité. Aucun contenu métier ni donnée utilisateur modifié.
