import React from 'react';
import WeatherMap from '@/components/WeatherMap';

const Index = () => {
  console.log('Index component rendering...');
  
  return (
    <div className="w-full h-screen overflow-hidden">
      <WeatherMap />
    </div>
  );
};

export default Index;