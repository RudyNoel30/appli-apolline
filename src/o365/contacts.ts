/**
 * Contacts Outlook (Microsoft Graph /me/contacts).
 * Permissions : Contacts.Read minimum (déclaré dans SCOPES de msal.ts).
 */
import { getAccessToken } from './msal'
import { O365_CLIENT_ID, O365_TENANT_ID } from './config'

const GRAPH = 'https://graph.microsoft.com/v1.0'

export type GraphContact = {
  id: string
  displayName?: string
  givenName?: string
  surname?: string
  middleName?: string
  title?: string
  companyName?: string
  jobTitle?: string
  emailAddresses?: { name?: string; address?: string }[]
  businessPhones?: string[]
  homePhones?: string[]
  mobilePhone?: string
  homeAddress?: PostalAddress
  businessAddress?: PostalAddress
  otherAddress?: PostalAddress
  birthday?: string
  personalNotes?: string
  categories?: string[]
}

export type PostalAddress = {
  street?: string
  city?: string
  state?: string
  countryOrRegion?: string
  postalCode?: string
}

export type Contact = {
  id: string
  prenom: string
  nom: string
  email?: string
  telephone?: string
  societe?: string
  titre?: string
  ville?: string
  notes?: string
  categories?: string[]
}

/**
 * Liste tous les contacts Outlook avec pagination Graph.
 * $top=999 = max ; on suit @odata.nextLink jusqu'à épuisement.
 */
export async function listContacts(): Promise<GraphContact[]> {
  const token = await getAccessToken(O365_CLIENT_ID, O365_TENANT_ID)
  if (!token) throw new Error('Non connecté à Microsoft 365')

  const select = [
    'id', 'displayName', 'givenName', 'surname', 'middleName', 'title',
    'companyName', 'jobTitle', 'emailAddresses', 'businessPhones', 'homePhones',
    'mobilePhone', 'homeAddress', 'businessAddress', 'otherAddress',
    'birthday', 'personalNotes', 'categories',
  ].join(',')

  const out: GraphContact[] = []
  let nextUrl: string | undefined = `${GRAPH}/me/contacts?$top=999&$orderby=displayName&$select=${select}`

  while (nextUrl) {
    const res = await fetch(nextUrl, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`Graph contacts ${res.status}: ${err.slice(0, 200)}`)
    }
    const json = (await res.json()) as { value: GraphContact[]; '@odata.nextLink'?: string }
    out.push(...json.value)
    nextUrl = json['@odata.nextLink']
  }
  return out
}

/**
 * Mappe un GraphContact → Contact Apolline (forme aplatie pour l'affichage).
 * Préfère les emails/téléphones pro, fallback perso.
 */
export function graphToContact(g: GraphContact): Contact {
  const email = g.emailAddresses?.[0]?.address
  const telephone = g.mobilePhone ?? g.businessPhones?.[0] ?? g.homePhones?.[0]
  const ville = g.businessAddress?.city ?? g.homeAddress?.city ?? g.otherAddress?.city
  return {
    id: g.id,
    prenom: g.givenName ?? '',
    nom: g.surname ?? g.displayName ?? '(Sans nom)',
    email,
    telephone,
    societe: g.companyName,
    titre: g.jobTitle,
    ville,
    notes: g.personalNotes,
    categories: g.categories,
  }
}
