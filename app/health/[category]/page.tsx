import { notFound } from 'next/navigation';
import { MILESTONE_CATEGORIES, isMilestoneCategory } from '@/domain/types';
import { CategoryDetail } from '@/components/health/CategoryDetail';

export function generateStaticParams() {
  return MILESTONE_CATEGORIES.map((category) => ({ category }));
}

export default async function CategoryPage(props: PageProps<'/health/[category]'>) {
  const { category } = await props.params;

  if (!isMilestoneCategory(category)) {
    notFound();
  }

  return <CategoryDetail category={category} />;
}
