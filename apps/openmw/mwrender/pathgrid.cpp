#include "pathgrid.hpp"

#include <cassert>

#include <osg/Geometry>
#include <osg/Group>
#include <osg/PositionAttitudeTransform>

#include <components/debug/debuglog.hpp>
#include <components/esm3/loadpgrd.hpp>
#include <components/misc/coordinateconverter.hpp>
#include <components/resource/resourcesystem.hpp>
#include <components/resource/scenemanager.hpp>
#include <components/sceneutil/pathgridutil.hpp>

#include "../mwbase/environment.hpp"
#include "../mwbase/world.hpp" // these includes can be removed once the static-hack is gone

#include "../mwmechanics/pathfinding.hpp"
#include "../mwworld/cellstore.hpp"
#include "../mwworld/esmstore.hpp"

#include "vismask.hpp"

namespace MWRender
{

    Pathgrid::Pathgrid(osg::ref_ptr<osg::Group> root)
        : mPathgridEnabled(false)
        , mRootNode(std::move(root))
        , mPathGridRoot(nullptr)
        , mInteriorPathgridNode(nullptr)
    {
    }

    Pathgrid::~Pathgrid()
    {
        if (mPathgridEnabled)
        {
            try
            {
                togglePathgrid();
            }
            catch (std::exception& e)
            {
                Log(Debug::Error) << "Failed to destroy pathgrid: " << e.what();
            }
        }
    }

    bool Pathgrid::toggleRenderMode(int mode)
    {
        switch (mode)
        {
            case Render_Pathgrid:
                togglePathgrid();
                return mPathgridEnabled;
            default:
                return false;
        }
    }

    void Pathgrid::addCell(const MWWorld::CellStore* store)
    {
        mActiveCells.push_back(store);
        if (mPathgridEnabled)
            enableCellPathgrid(store);
    }

    void Pathgrid::removeCell(const MWWorld::CellStore* store)
    {
        mActiveCells.erase(std::remove(mActiveCells.begin(), mActiveCells.end(), store), mActiveCells.end());
        if (mPathgridEnabled)
            disableCellPathgrid(store);
    }

    void Pathgrid::togglePathgrid()
    {
        mPathgridEnabled = !mPathgridEnabled;
        if (mPathgridEnabled)
        {
            // add path grid meshes to already loaded cells
            mPathGridRoot = new osg::Group;
            mPathGridRoot->setNodeMask(Mask_Debug);
            mRootNode->addChild(mPathGridRoot);

            for (const MWWorld::CellStore* cell : mActiveCells)
            {
                enableCellPathgrid(cell);
            }
        }
        else
        {
            // remove path grid meshes from already loaded cells
            for (const MWWorld::CellStore* cell : mActiveCells)
            {
                disableCellPathgrid(cell);
            }

            if (mPathGridRoot)
            {
                mRootNode->removeChild(mPathGridRoot);
                mPathGridRoot = nullptr;
            }
        }
    }

    void Pathgrid::enableCellPathgrid(const MWWorld::CellStore* store)
    {
        MWBase::World* world = MWBase::Environment::get().getWorld();

        const ESM::Pathgrid* pathgrid = world->getStore().get<ESM::Pathgrid>().search(*store->getCell());
        if (!pathgrid)
            return;

        osg::Vec3f cellPathGridPos(0, 0, 0);
        Misc::makeCoordinateConverter(*store->getCell()).toWorld(cellPathGridPos);

        osg::ref_ptr<osg::PositionAttitudeTransform> cellPathGrid = new osg::PositionAttitudeTransform;
        cellPathGrid->setPosition(cellPathGridPos);

        osg::ref_ptr<osg::Geometry> geometry = SceneUtil::createPathgridGeometry(*pathgrid);

        MWBase::Environment::get().getResourceSystem()->getSceneManager()->recreateShaders(geometry, "debug");

        cellPathGrid->addChild(geometry);

        mPathGridRoot->addChild(cellPathGrid);

        if (store->getCell()->isExterior())
        {
            mExteriorPathgridNodes[std::make_pair(store->getCell()->getGridX(), store->getCell()->getGridY())]
                = cellPathGrid;
        }
        else
        {
            assert(mInteriorPathgridNode == nullptr);
            mInteriorPathgridNode = cellPathGrid;
        }
    }

    void Pathgrid::disableCellPathgrid(const MWWorld::CellStore* store)
    {
        if (store->getCell()->isExterior())
        {
            ExteriorPathgridNodes::iterator it = mExteriorPathgridNodes.find(
                std::make_pair(store->getCell()->getGridX(), store->getCell()->getGridY()));
            if (it != mExteriorPathgridNodes.end())
            {
                mPathGridRoot->removeChild(it->second);
                mExteriorPathgridNodes.erase(it);
            }
        }
        else
        {
            if (mInteriorPathgridNode)
            {
                mPathGridRoot->removeChild(mInteriorPathgridNode);
                mInteriorPathgridNode = nullptr;
            }
        }
    }

}
