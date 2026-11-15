import type { APIRoute } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { toCss } from '../../system/export.ts';

export async function getStaticPaths() {
  return (await getCollection('brands')).map((brand) => ({ params: { brand: brand.id }, props: { brand } }));
}

export const GET: APIRoute = ({ props }) => {
  const { brand } = props as { brand: CollectionEntry<'brands'> };
  return new Response(toCss(brand.data.name, brand.data.tokens), { headers: { 'Content-Type': 'text/css' } });
};
