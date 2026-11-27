# JSB Manager — dossier de préparation juridique V36

Statut : projets pour la préproduction privée ; **publication commerciale verrouillée**.
Les textes de référence figurent dans `apps/shared/legal-content.mjs`.
Les brouillons enregistrés en administration sont immuables et ne sont pas publiés.
Les CGV ne sont pas actives : aucun abonnement ni paiement.

## Vérifications avant publication

| Point | État / preuve attendue |
|---|---|
| Responsable de traitement et éditeur | Identité juridique réelle, statut, adresse professionnelle, immatriculation si applicable, contact et directeur de publication. Ne pas inventer d'identifiants. |
| Hébergement | Identité et coordonnées contractuelles de l'hébergeur, région, DPA, sous-traitants, transferts et garanties à vérifier. |
| Information des personnes | Contact permanent pour les droits, finalités, bases, destinataires, durées et droits selon les articles 13/14 du RGPD. |
| Club | Identifier le responsable de traitement, établir les responsabilités de JSB et, si applicable, contrat de sous-traitance art. 28 ; information des licenciés et représentants. |
| Conservation | Approuver le tableau des traitements, mettre en œuvre et recetter la purge des comptes, sessions, tokens, quotas, outbox, logs, registres, sauvegardes et journal juridique. |
| Droits | Procédure de vérification proportionnée, accès, export, rectification, effacement ou anonymisation, limitation et réponse dans les délais légaux. |
| Sécurité | Révocation, cloisonnement, coffre local, prévention des doublons, procédure de notification des incidents. |
| Offre commerciale | Si paiement activé : offre et prix réels, CGV B2B/B2C adaptées, garanties, rétractation si applicable, médiateur désigné, résiliation électronique si requise. |
| Publication | Relecture juridique, approbation explicite du texte exact, date d'effet, version et empreinte, conservation proportionnée des preuves, parcours de réacceptation des CGU. |

## Projet de politique de conservation (à valider, non exécuté)

- Sessions et jetons : expiration selon les règles de sécurité existantes ; purge des lignes expirées planifiée et testée séparément.
- Comptes et brouillons de préproduction : conserver uniquement pendant le test, puis clôturer ou supprimer selon une procédure validée.
- Registres réels de licenciés : interdits en préproduction. Pour une offre future, le club fixe la durée proportionnée à la finalité et aux obligations applicables ; distinguer saison active, archive justifiée et effacement.
- Journaux et preuves : fixer une durée spécifique par finalité et obligation ; le journal immuable actuel nécessite une procédure contrôlée de purge/anonymisation. Ne pas supprimer arbitrairement la preuve ni la conserver indéfiniment par défaut.
- Coffres locaux : effacement contrôlé sur l'appareil après synchronisation, sans confusion avec l'effacement serveur.

## Références officielles à contrôler lors de la validation
- RGPD (UE) 2016/679, notamment articles 5, 6, 12 à 22, 28, 32 à 34 et chapitre V : https://eur-lex.europa.eu/eli/reg/2016/679/oj
- CNIL, licences sportives : https://www.cnil.fr/fr/licences-sportives-les-principales-regles-respecter-pour-la-protection-des-donnees-personnelles
- CNIL, cookies et traceurs : https://www.cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi
- Ministère de l'économie, mentions sur un site : https://www.economie.gouv.fr/entreprises/developper-son-entreprise/innover-et-numeriser-son-entreprise/mentions-sur-votre-site-internet-les-obligations-respecter
- DGCCRF, informations précontractuelles : https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/les-informations-precontractuelles

## Mise en œuvre V36 — demandes et conservation

- Demandes personnelles : dépôt authentifié d'un type de droit (sans champ libre ni justificatif), référence et date de réception, déduplication d'une demande ouverte de même type, consultation par le propriétaire.
- Espace Admin : file des demandes ouvertes, contact du compte, prise en charge puis enregistrement explicite de la réponse réellement transmise. Contrôle de révision et autorisation distincte. Aucune réponse envoyée ni donnée supprimée par le simple changement d'état.
- Délai : objectif interne indicatif d'un mois calendaire ; organiser la réponse dans les meilleurs délais. Vérifier le délai applicable, les cas particuliers et les éventuelles prolongations motivées. Prévoir un canal accessible hors connexion et aux personnes sans compte (contact permanent à renseigner).
- La procédure doit couvrir aussi les demandes reçues hors de l'application, les personnes dont le compte est fermé et les droits des personnes concernées par les traitements des clubs. Ne pas exiger de compte pour exercer un droit.
- Purge technique dédiée : `node scripts/render-preprod-retention.cjs` (simulation, compteurs seuls) ; `node scripts/render-preprod-retention.cjs --apply` (exécution explicite après validation, uniquement sur jsb_preprod). Préserve comptes, preuves juridiques, demandes RGPD, registres et brouillons. Expiration des sessions et jetons, envois expirés ou épuisés sans bail actif, quotas âgés de plus de 24 heures. Aucune exécution ni planification automatique activée.
- Avant ouverture publique : approuver les règles de conservation des demandes et preuves, la procédure d'effacement/anonymisation effective, les réponses sécurisées et le registre de traitements ; vérifier le traitement des sauvegardes et copies locales. Les demandes clôturées restent actuellement conservées et ne sont pas purgées par la commande technique.

Références : https://www.cnil.fr/fr/repondre-une-demande-de-droit-dacces ; https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees ; https://www.cnil.fr/fr/minimiser-les-donnees-collectees.
