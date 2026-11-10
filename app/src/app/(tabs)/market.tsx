import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MandiPrices } from '@/components/market/MandiPrices';
import { ProduceMarket } from '@/components/market/ProduceMarket';
import { SeedShop } from '@/components/market/SeedShop';
import { Chip, ChipRow, Screen } from '@/components/ui';

const SECTIONS = ['prices', 'produce', 'seeds'] as const;
type Section = (typeof SECTIONS)[number];

/** Market hub: mandi prices, direct produce sales, and the seed/input shop. */
export default function Market() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ tab?: string }>();
  const section: Section = SECTIONS.includes(params.tab as Section) ? (params.tab as Section) : 'prices';

  return (
    <Screen>
      <ChipRow>
        <Chip label={t('market.tabPrices')} icon="stats-chart" selected={section === 'prices'} onPress={() => router.setParams({ tab: 'prices' })} />
        <Chip label={t('market.tabProduce')} icon="storefront" selected={section === 'produce'} onPress={() => router.setParams({ tab: 'produce' })} />
        <Chip label={t('market.tabSeeds')} icon="leaf" selected={section === 'seeds'} onPress={() => router.setParams({ tab: 'seeds' })} />
      </ChipRow>
      {section === 'prices' ? <MandiPrices /> : section === 'produce' ? <ProduceMarket /> : <SeedShop />}
    </Screen>
  );
}
