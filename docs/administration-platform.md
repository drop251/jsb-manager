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

## Sécurité grand public : exigences et recette obligatoire
L'expérience utilisateur doit rester simple sans affaiblir la sécurité. Coach et particulier sont des comptes grand public ; aucune confiance dans un rôle, un identifiant ou un périmètre envoyé par le client.

| Domaine | Scénarios de recette obligatoires | État |
|---|---|---|
| Inscription et authentification | Vérification e-mail, mots de passe hachés côté serveur, limitation des tentatives, réponses non révélatrices de l'existence d'un compte | À implémenter |
| Réinitialisation | Jeton à durée limitée, usage unique, invalidation des sessions selon politique, refus des jetons expirés ou réutilisés | À implémenter |
| Sessions | Expiration, déconnexion, révocation, protection CSRF selon mécanisme, cookies sécurisés si utilisés, refus des sessions suspendues | À implémenter |
| Permissions coach | Refus d'accès administration et autres clubs ; contrôle par action, appartenance réelle et ressource ; révocation des droits | Politique pure à tester ; API à implémenter |
| Permissions particulier | Refus de toutes les ressources club et administration ; isolation des séances, sauvegardes, acceptations et données de compte | Politique pure à tester ; API à implémenter |
| API et exports | Requêtes directes sans interface, identifiants substitués, exports et restaurations inter-comptes, validation des entrées | À implémenter |
| Données personnelles | Minimisation, export et suppression authentifiés, politique de conservation, aucun accès admin aux licenciés, contrôle des journaux | À implémenter |
| Fichiers | Limites de taille, contrôle du contenu, prévention des chemins malveillants et scripts injectés, aucune restauration non autorisée | À implémenter |
| PWA et hors ligne | Séparation des caches et données entre comptes, déconnexion sur appareil partagé, reprise sans fuite, pas de données privées en cache public | À implémenter |
| Documents légaux | Version exacte acceptée, horodatage serveur, preuve non falsifiable par le client, nouvelle acceptation selon nécessité | À implémenter |
| Paiement éventuel | Prestataire de paiement, validation serveur des notifications, idempotence, aucun stockage des données carte | Conditionnel, à implémenter |

Les tests de politique pure ne valent pas tests d'intégration, d'authentification, de stockage ou de sécurité réseau. La publication grand public est bloquée tant que les contrôles applicables ne sont pas implémentés et testés côté serveur et navigateur. Les contrôles commerciaux restent conditionnels à l'offre retenue. Aucune collecte nouvelle n'est activée par ce document.

## Gestion multicomptes — JSB Manager grand public
Depuis Réglages > Gestion des comptes, proposer : compte actif, comptes mémorisés sur cet appareil, Ajouter un compte existant, Créer un nouveau compte, Changer de compte, Retirer un compte de cet appareil, Se déconnecter et Se déconnecter de tous les comptes de cet appareil. La suppression définitive relève d'un parcours distinct, authentifié, explicite et soumis aux règles de conservation à définir.

- Une seule identité active à la fois dans une instance de JSB Manager. Coach et Particulier sont deux comptes distincts, avec des adresses e-mail uniques selon le modèle actuel. Aucun changement de rôle local. Aucun compte Administrateur dans cette liste, dans l'inscription ou dans la connexion publique.
- Première livraison : mémoriser uniquement des indications non secrètes de compte, avec accord explicite de l'utilisateur et option appareil partagé sans mémorisation. Réauthentification lors du changement de compte ; pas de mot de passe, jeton de session ou jeton de renouvellement conservé dans localStorage/IndexedDB. La session web active doit utiliser un cookie serveur HttpOnly, Secure et une protection CSRF adaptée. Pas de connexion silencieuse. Une optimisation biométrique native éventuelle exige une étude séparée.
- Création d'un nouveau compte depuis les réglages : conserver l'identité active tant que le parcours d'inscription et de vérification n'est pas terminé ; ne pas confondre inscription et changement de compte. Le basculement exige une authentification réussie du compte cible et une confirmation explicite.
- Avant le changement : terminer ou bloquer les écritures en cours, signaler les modifications non enregistrées et les synchronisations en attente, laisser choisir de rester sur le compte actuel. Aucun transfert automatique des données vers le compte cible.
- Pendant le changement : bloquer la navigation privée, invalider les requêtes, abonnements et réponses tardives de l'ancien contexte, isoler les caches, brouillons, files hors ligne, exports, états UI et données par identifiant serveur et club autorisé. Ne charger l'espace cible qu'après confirmation de son identité par le serveur. En cas d'échec, conserver l'ancien contexte uniquement si sa session est encore valide, sinon revenir à un écran verrouillé.
- Le changement de compte et la déconnexion révoquent la session de cet appareil, pas celles des autres appareils. La déconnexion de tous les appareils, si proposée, est une action distincte nécessitant une preuve récente. Retirer un compte de l'appareil ne supprime pas le compte distant ; supprimer ses métadonnées locales et purger les données locales associées selon un parcours avertissant des écritures non synchronisées.
- Hors ligne : aucun changement d'identité ni authentification simulée ; l'accès hors ligne éventuel est limité au dernier espace autorisé selon une politique dédiée et doit rester verrouillé après déconnexion. Ne jamais exposer le cache d'un autre compte, même après fermeture, retour navigateur, rechargement ou changement d'onglet.
- Déploiement : la PWA historique reste intacte ; aucune migration, suppression ou activation de comptes automatique. L'interface et l'API multicomptes sont à implémenter et à tester avant publication.

### Recette multicomptes obligatoire
| Scénario | Attendu |
|---|---|
| Ajouter ou créer un compte depuis les réglages | Sans relancer l'application |
| Coach A vers Particulier B, puis retour A | Identité serveur vérifiée, données propres à chaque compte |
| Mot de passe incorrect, session expirée ou compte suspendu | Aucun basculement non autorisé |
| Tentative de connexion Administrateur via la version publique | Refus avant émission d'une session |
| Requête ou synchronisation tardive du compte A après changement vers B | Ni affichage ni écriture dans B |
| Changement avec brouillon ou file non synchronisée | Avertissement et choix explicite, aucune perte silencieuse |
| Changement hors ligne ou entre plusieurs onglets | Refus hors ligne, verrouillage et resynchronisation des onglets |
| Déconnexion, retour navigateur, rechargement et réouverture | Aucune fuite de données privées |
| Retirer un compte de l'appareil | Métadonnées locales retirées, compte distant intact |
| Déconnexion de cet appareil | Autres appareils non affectés |
| Suppression définitive | Parcours séparé, confirmation et réauthentification ; pas d'activation avant politique de conservation |
