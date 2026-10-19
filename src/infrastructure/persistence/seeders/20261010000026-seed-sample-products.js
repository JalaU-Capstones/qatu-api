'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('Skipping seeder in production.');
      return;
    }

    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        insert into auth.users (id, email, raw_user_meta_data)
        values (
          '00000000-0000-0000-0000-000000000002'::uuid,
          'seller@qatu.local',
          '{"username": "sample_seller", "full_name": "Sample Seller"}'::jsonb
        )
        on conflict (id) do nothing;

        insert into public.profiles (id, username, full_name, email)
        values (
          '00000000-0000-0000-0000-000000000002'::uuid,
          'sample_seller',
          'Sample Seller',
          'seller@qatu.local'
        )
        on conflict (id) do update set
          username = excluded.username,
          full_name = excluded.full_name,
          email = excluded.email;

        insert into public.user_roles (profile_id, role_id)
        select
          '00000000-0000-0000-0000-000000000002'::uuid,
          r.id
        from public.roles r
        where r.name = 'seller'
        on conflict (profile_id, role_id) do nothing;

        insert into public.products (
          id,
          seller_id,
          category_id,
          name,
          slug,
          description,
          price,
          currency,
          stock,
          attributes,
          primary_image_path,
          state,
          published_at,
          average_rating,
          ratings_count
        )
        values
          -- Category 1: Electronics (5 products)
          (
            '10000000-0000-0000-0000-000000000001'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'electronics'),
            'Wireless Noise-Canceling Headphones',
            'wireless-noise-canceling-headphones',
            'Over-ear Bluetooth headphones with active noise cancellation and 30-hour battery life.',
            199.99,
            'USD',
            45,
            '{"color": "Midnight Black", "warranty_months": 24}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000001/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000002'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'electronics'),
            'Ultra-Slim Mechanical Keyboard',
            'ultra-slim-mechanical-keyboard',
            'Compact mechanical keyboard with low-profile tactile switches and RGB backlighting.',
            89.99,
            'USD',
            70,
            '{"color": "Space Gray", "warranty_months": 12}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000002/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000003'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'electronics'),
            '4K Ultra HD Action Camera',
            '4k-ultra-hd-action-camera',
            'Waterproof action camera with dual screens, image stabilization, and 4K recording.',
            129.99,
            'USD',
            30,
            '{"color": "Matte Black", "warranty_months": 12}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000003/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000004'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'electronics'),
            'Smart Home Security Camera',
            'smart-home-security-camera',
            'Wi-Fi connected indoor security camera featuring motion tracking and night vision.',
            49.99,
            'USD',
            85,
            '{"color": "White", "warranty_months": 24}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000004/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000005'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'electronics'),
            'Portable Bluetooth Speaker',
            'portable-bluetooth-speaker',
            'Rugged outdoor speaker delivering rich bass, 360-degree sound, and IPX7 waterproofing.',
            59.99,
            'USD',
            110,
            '{"color": "Teal", "warranty_months": 12}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000005/primary.webp',
            'published',
            now(),
            0,
            0
          ),

          -- Category 2: Clothing (5 products)
          (
            '10000000-0000-0000-0000-000000000006'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'clothing'),
            'Classic Heavyweight Cotton T-Shirt',
            'classic-heavyweight-cotton-t-shirt',
            'Relaxed fit everyday t-shirt crafted from 100% organic combed cotton.',
            24.99,
            'USD',
            150,
            '{"size": "L", "material": "100% Organic Cotton"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000006/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000007'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'clothing'),
            'Slim-Fit Stretch Denim Jeans',
            'slim-fit-stretch-denim-jeans',
            'Durable yet flexible five-pocket jeans designed for daily comfort and style.',
            69.99,
            'USD',
            95,
            '{"size": "32x32", "material": "98% Cotton 2% Elastane"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000007/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000008'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'clothing'),
            'Merino Wool Knit Sweater',
            'merino-wool-knit-sweater',
            'Breathable and naturally insulating crewneck sweater woven from fine merino wool.',
            119.99,
            'USD',
            40,
            '{"size": "M", "material": "100% Merino Wool"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000008/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000009'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'clothing'),
            'Waterproof Windbreaker Jacket',
            'waterproof-windbreaker-jacket',
            'Lightweight packable hooded jacket offering reliable wind and rain protection.',
            84.99,
            'USD',
            60,
            '{"size": "XL", "material": "100% Recycled Nylon"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000009/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000010'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'clothing'),
            'Everyday Canvas Low-Top Sneakers',
            'everyday-canvas-low-top-sneakers',
            'Timeless casual footwear with vulcanized rubber soles and padded insoles.',
            49.99,
            'USD',
            80,
            '{"size": "10 US", "material": "Cotton Canvas"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000010/primary.webp',
            'published',
            now(),
            0,
            0
          ),

          -- Category 3: Home & Garden (5 products)
          (
            '10000000-0000-0000-0000-000000000011'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'home-and-garden'),
            'Ergonomic High-Back Office Chair',
            'ergonomic-high-back-office-chair',
            'Breathable mesh desk chair with adjustable lumbar support and 3D armrests.',
            249.99,
            'USD',
            25,
            '{"dimensions_cm": "65x65x120", "color": "Charcoal Black"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000011/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000012'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'home-and-garden'),
            'Cast Iron Dutch Oven Pot',
            'cast-iron-dutch-oven-pot',
            'Heavy-duty enameled cast iron casserole pot perfect for braising and baking sourdough.',
            79.99,
            'USD',
            50,
            '{"dimensions_cm": "26x26x16", "color": "Cherry Red"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000012/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000013'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'home-and-garden'),
            'Dimmable Minimalist Desk Lamp',
            'dimmable-minimalist-desk-lamp',
            'Modern LED reading lamp with touch brightness controls and integrated USB charging port.',
            39.99,
            'USD',
            90,
            '{"dimensions_cm": "15x15x42", "color": "Brushed Nickel"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000013/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000014'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'home-and-garden'),
            'Self-Watering Indoor Herb Planter',
            'self-watering-indoor-herb-planter',
            'Tiered windowsill planter system with water level indicator and drainage reservoir.',
            29.99,
            'USD',
            65,
            '{"dimensions_cm": "40x15x18", "color": "Sage Green"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000014/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000015'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'home-and-garden'),
            'Stainless Steel Kitchen Knife Set',
            'stainless-steel-kitchen-knife-set',
            'Six-piece precision-forged high-carbon steel knife block set with wooden stand.',
            149.99,
            'USD',
            35,
            '{"dimensions_cm": "20x15x35", "color": "Natural Wood"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000015/primary.webp',
            'published',
            now(),
            0,
            0
          ),

          -- Category 4: Sports (5 products)
          (
            '10000000-0000-0000-0000-000000000016'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'sports'),
            'Adjustable Quick-Select Dumbbell',
            'adjustable-quick-select-dumbbell',
            'Compact strength training dumbbell with quick-twist dial ranging from 2 to 24 kg.',
            179.99,
            'USD',
            20,
            '{"weight_kg": 24, "color": "Black and Red"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000016/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000017'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'sports'),
            'High-Density Yoga and Pilates Mat',
            'high-density-yoga-and-pilates-mat',
            'Extra-thick non-slip exercise mat with alignment marks and carrying strap.',
            34.99,
            'USD',
            120,
            '{"weight_kg": 1.2, "color": "Navy Blue"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000017/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000018'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'sports'),
            'Insulated Stainless Steel Water Bottle',
            'insulated-stainless-steel-water-bottle',
            'Double-wall vacuum insulated sports bottle that keeps drinks cold for 24 hours.',
            22.99,
            'USD',
            175,
            '{"weight_kg": 0.45, "color": "Cobalt Blue"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000018/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000019'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'sports'),
            'Trail Running Hydration Backpack',
            'trail-running-hydration-backpack',
            'Lightweight aerodynamic backpack equipped with a 2-liter leak-proof water bladder.',
            64.99,
            'USD',
            55,
            '{"weight_kg": 0.55, "color": "Neon Lime"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000019/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000020'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'sports'),
            'Speed Jump Rope with Ball Bearings',
            'speed-jump-rope-with-ball-bearings',
            'Tangle-free steel cable jump rope with aluminum handles for cross-training.',
            16.99,
            'USD',
            200,
            '{"weight_kg": 0.25, "color": "Metallic Silver"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000020/primary.webp',
            'published',
            now(),
            0,
            0
          ),

          -- Category 5: Books (5 products)
          (
            '10000000-0000-0000-0000-000000000021'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'books'),
            'Clean Architecture: A Craftsman Guide',
            'clean-architecture-a-craftsman-guide',
            'Essential principles of software structure, component design, and separation of concerns.',
            39.99,
            'USD',
            85,
            '{"author": "Robert C. Martin", "pages": 432, "language": "en"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000021/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000022'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'books'),
            'Designing Data-Intensive Applications',
            'designing-data-intensive-applications',
            'Comprehensive guide to data systems, distributed storage, and reliable streaming architectures.',
            49.99,
            'USD',
            75,
            '{"author": "Martin Kleppmann", "pages": 616, "language": "en"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000022/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000023'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'books'),
            'Refactoring: Improving the Design of Existing Code',
            'refactoring-improving-the-design-of-existing-code',
            'A timeless catalog of refactorings and techniques to improve code maintainability.',
            44.99,
            'USD',
            60,
            '{"author": "Martin Fowler", "pages": 448, "language": "en"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000023/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000024'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'books'),
            'Domain-Driven Design: Tackling Complexity in Software',
            'domain-driven-design-tackling-complexity-in-software',
            'Foundational text introducing ubiquitous language, bounded contexts, and aggregate roots.',
            54.99,
            'USD',
            40,
            '{"author": "Eric Evans", "pages": 560, "language": "en"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000024/primary.webp',
            'published',
            now(),
            0,
            0
          ),
          (
            '10000000-0000-0000-0000-000000000025'::uuid,
            '00000000-0000-0000-0000-000000000002'::uuid,
            (select id from public.categories where slug = 'books'),
            'The Pragmatic Programmer: Your Journey to Mastery',
            'the-pragmatic-programmer-your-journey-to-mastery',
            'Practical advice and timeless wisdom covering career development and coding craft.',
            42.99,
            'USD',
            90,
            '{"author": "David Thomas, Andrew Hunt", "pages": 352, "language": "en"}'::jsonb,
            'product-images/10000000-0000-0000-0000-000000000025/primary.webp',
            'published',
            now(),
            0,
            0
          )
        on conflict (id) do nothing;
      `,
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `
        delete from public.products
        where seller_id = '00000000-0000-0000-0000-000000000002'::uuid;

        delete from public.user_roles
        where profile_id = '00000000-0000-0000-0000-000000000002'::uuid;

        delete from public.profiles
        where id = '00000000-0000-0000-0000-000000000002'::uuid;

        delete from auth.users
        where id = '00000000-0000-0000-0000-000000000002'::uuid;
      `,
        { transaction }
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
