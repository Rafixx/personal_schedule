import { useEffect } from 'react';
import MonthGrid from '../components/MonthGrid/MonthGrid';
import DishDrawer from '../components/Drawer/DishDrawer';
import ShoppingList from '../components/ShoppingList/ShoppingList';
import BannerUpdate from '../components/BannerUpdate';
import Header from '../components/Header';
import { fetchRemoteMenu } from '../data/fetchMenu';
import { useMenuStore } from '../state/useMenuStore';

export default function Planner() {
  const setMenu = useMenuStore((s) => s.setMenu);

  useEffect(() => {
    fetchRemoteMenu().then((data) => {
      if (data) setMenu(data);
    });
  }, [setMenu]);

  return (
    <div>
      <Header />
      <BannerUpdate />
      <MonthGrid />
      <DishDrawer />
      <ShoppingList />
    </div>
  );
}
