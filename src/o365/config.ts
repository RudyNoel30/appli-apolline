/**
 * Config Azure AD du Groupe Apolline — en dur dans le binaire.
 *
 * À mettre à jour ici si l'app est ré-enregistrée sur Azure (ex: changement de
 * locataire, app Apolline supprimée et recréée).
 *
 * Comment retrouver ces valeurs :
 *   portal.azure.com → Microsoft Entra ID → App registrations → "Apolline" → Vue d'ensemble
 *   - Application (client) ID
 *   - Directory (tenant) ID
 */
export const O365_CLIENT_ID = '498e995f-668e-44db-ac66-bbe8d203667d'
export const O365_TENANT_ID = '15f4805f-b992-4e5f-b5c3-ecb09fea400f'
