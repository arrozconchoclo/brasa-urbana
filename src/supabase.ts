import { projectId, publicAnonKey } from '../utils/supabase/info'

const apiUrl = `https://${projectId}.supabase.co/rest/v1`

export type CatalogCategory = { id: number; name: string }
export type CatalogProduct = {
  id: number
  category_id: number
  name: string
  description: string | null
  price: number
  badge: string | null
  image_url: string | null
}
export type CatalogPromotion = {
  id: number
  name: string
  description: string | null
  price: number
  image_url: string | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiUrl}${path}`
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: publicAnonKey,
      Authorization: `Bearer ${publicAnonKey}`,
      ...init?.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload.message || payload.error || 'Respuesta inválida de Supabase.'
    const details = payload.details ? ` ${payload.details}` : ''
    const code = payload.code ? ` [${payload.code}]` : ''
    throw new Error(`Supabase ${response.status} en ${path}: ${message}${details}${code}`)
  }
  return payload
}

export async function getCatalog() {
  const [categories, products, promotions] = await Promise.all([
    request<CatalogCategory[]>('/categories?select=*&order=id'),
    request<CatalogProduct[]>('/products?select=*&order=id'),
    request<CatalogPromotion[]>('/promotions?select=*&order=id'),
  ])
  return { categories, products, promotions }
}

export type OrderPayload = {
  customer: { name: string; phone: string; email: string; address: string }
  deliveryMethod: string
  paymentMethod: string
  subtotal: number
  tax: number
  total: number
  items: Array<{
    productId: number
    productName: string
    quantity: number
    unitPrice: number
    options: string[]
  }>
}

export async function createOrder(order: OrderPayload) {
  const orderNumber = `BU-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
  const rows = await request<Array<{ id: number }>>('/orders', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      order_number: orderNumber,
      customer_name: order.customer.name,
      email: order.customer.email,
      phone: order.customer.phone,
      delivery_type: order.deliveryMethod,
      address: order.customer.address || null,
      payment_method: order.paymentMethod,
      total: order.total,
    }),
  })
  const savedOrder = rows[0]
  if (!savedOrder) throw new Error('Supabase no devolvió el pedido guardado.')

  try {
    await request('/order_items', {
      method: 'POST',
      body: JSON.stringify(order.items.map(item => ({
        order_id: savedOrder.id,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      }))),
    })
  } catch (error) {
    await request(`/orders?id=eq.${savedOrder.id}`, { method: 'DELETE' }).catch(() => undefined)
    throw error
  }

  return { orderNumber }
}
