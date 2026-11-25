# JSB Manager — Contrat fonctionnel Administrateur / Utilisateur

## Périmètre validé
L’administrateur de la plateforme ne gère pas les licenciés, présences individuelles, bilans individuels ou plannings des clubs. Les coachs et particuliers disposent de comptes utilisateurs distincts. Le coach gère uniquement les données de son espace autorisé. Le particulier ne dispose pas par défaut de fonctions de gestion de club.

## Matrice cible (refus par défaut)
| Ressource | Administrateur | Coach | Particulier |
|---|---|---|---|
| Catalogue de référence : gestion | Oui | Non | Non |
| Catalogue : consultation | Oui | Oui | Oui |
| Générateurs : test ou utilisation | Oui, contexte de test isolé | Oui | Oui |
| Comptes plateforme : administration | Oui, métadonnées nécessaires | Non | Non |
| Statistiques plateforme agrégées | Oui | Non | Non |
| CGU/CGV : édition et publication | Oui | Non | Non |
| CGU/CGV : lecture et acceptation applicable | Oui | Oui | Oui |
| Licenciés, présences, bilans et planning club | Non | Espace autorisé uniquement | Non |
| Séances privées et sauvegardes utilisateur | Non | Espace autorisé uniquement | Espace propre uniquement |

## Architecture cible
- Authentification serveur, rôle attribué côté serveur, aucun rôle fiable provenant du navigateur.
- Autorisation par ressource et action sur chaque requête, refus par défaut, isolation des espaces et contrôle des identifiants.
- Données plateforme distinctes des données métier des clubs. Aucun export administrateur ne doit inclure les données privées des clubs.
- Comptes : identifiant, catégorie coach/particulier, état, dates pertinentes, offre éventuelle ; jamais de mot de passe lisible.
- Statistiques : événements minimisés et agrégés, sans noms de licenciés, contenu de séance, données de santé ou présences individuelles ; politique de conservation et choix de mesure à définir avant collecte.
- Documents légaux : brouillon, version publiée immuable, date d’effet, historique, preuve d’acceptation lorsque nécessaire. Aucun texte fictif publié comme document légal.
- Abonnements et assistance : à spécifier selon le modèle économique ; aucune collecte de paiement à ce stade.
- Journal des actions administratives sensibles, authentification renforcée, contrôle des exports, tests d’accès direct et inter-comptes.

## Migration
Conserver le code et les données locales des fonctions club pour la future version utilisateur. Ne pas migrer, supprimer ou publier automatiquement ces données. La PWA locale existante ne constitue pas un système d’autorisation distant. Le masquage UI ne suffit pas ; aucune prétention de sécurité multi-utilisateur avant backend, tests et revue.

## Critères de livraison
1. Navigation administrateur distincte, aucune route club dans cet espace.
2. Tests négatifs d’accès direct, d’API et d’export (administrateur vers club, utilisateur vers administration, coach vers autre espace).
3. Comptes réels et statistiques seulement après intégration du backend ; état indisponible explicite en attendant, pas de chiffres simulés en production.
4. Gestion documentaire versionnée, publication explicite ; textes légaux à valider séparément.
5. Recettes de non-régression du catalogue et des générateurs, conservation des données utilisateur.

## Ordre des travaux
V36 : séparation et contrat des droits ; V37 : tableau de bord ; V38 : comptes ; V39 : statistiques ; V40 : documents légaux ; commercial et assistance après définition du modèle ; sécurité dès V36 et recette complète avant publication.
